
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Course, CourseActivationCode, UserRole } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { enrollUserInCourseAction } from '@/app/(app)/admin/lms/courses/actions'; // Re-use action

export default function ActivateLmsCoursePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activationCode, setActivationCode] = useState('');
  const [targetCourseId, setTargetCourseId] = useState<string | null>(null);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // User's primary UUID
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); // Student or Teacher profile ID
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const courseIdFromQuery = searchParams.get('courseId');
    if (courseIdFromQuery) {
      setTargetCourseId(courseIdFromQuery);
      supabase.from('lms_courses').select('*').eq('id', courseIdFromQuery).single()
        .then(({data, error}) => {
          if (error || !data) console.error("Error fetching target course for activation page:", error);
          else setTargetCourse(data as Course);
        });
    }

    if (typeof window !== 'undefined') {
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        const userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId && role) {
            const profileTable = role === 'student' ? 'students' : 'teachers';
            supabase.from(profileTable).select('id, school_id').eq('user_id', userId).single()
            .then(({ data: userProfile, error: profileError }) => {
                if (profileError || !userProfile) {
                    toast({ title: "Error", description: "Could not load user profile for activation.", variant: "destructive"});
                } else {
                    setCurrentUserProfileId(userProfile.id);
                    setCurrentSchoolId(userProfile.school_id);
                }
            });
        }
    }
  }, [searchParams, toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!activationCode.trim()) {
      toast({ title: "Error", description: "Please enter an activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (!currentUserProfileId || !currentUserRole || !currentSchoolId) {
      toast({ title: "Error", description: "User profile or school not identified. Please log in or ensure your profile is complete.", variant: "destructive"});
      setIsLoading(false);
      return;
    }

    // Check code validity
    const {data: codeToActivate, error: codeError} = await supabase
        .from('lms_course_activation_codes')
        .select('*')
        .eq('code', activationCode.trim())
        .single();
    
    if (codeError || !codeToActivate) {
      setMessage({type: 'error', text: "Invalid activation code."});
      toast({ title: "Activation Failed", description: "Invalid activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (codeToActivate.is_used) {
      setMessage({type: 'error', text: "This activation code has already been used."});
      toast({ title: "Activation Failed", description: "This activation code has already been used.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (codeToActivate.expiry_date && new Date() > new Date(codeToActivate.expiry_date)) {
      setMessage({type: 'error', text: "This activation code has expired."});
      toast({ title: "Activation Failed", description: "This activation code has expired.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    // If code is school-specific, ensure it matches current user's school
    if (codeToActivate.school_id && codeToActivate.school_id !== currentSchoolId) {
      setMessage({type: 'error', text: "This activation code is not valid for your institution."});
      toast({ title: "Activation Failed", description: "Code not valid for your institution.", variant: "destructive"});
      setIsLoading(false);
      return;
    }

    // Enroll user
    const enrollmentResult = await enrollUserInCourseAction({
      course_id: codeToActivate.course_id,
      user_profile_id: currentUserProfileId, // This is students.id or teachers.id
      user_type: currentUserRole,
    });

    if (!enrollmentResult.ok && !enrollmentResult.message.includes("already enrolled")) { // Allow if already enrolled by another means
      setMessage({type: 'error', text: `Enrollment failed: ${enrollmentResult.message}`});
      toast({ title: "Activation Failed", description: `Enrollment failed: ${enrollmentResult.message}`, variant: "destructive"});
      setIsLoading(false);
      return;
    }
    
    // Mark code as used
    const { error: updateCodeError } = await supabase
      .from('lms_course_activation_codes')
      .update({ is_used: true, used_by_user_id: currentUserId, used_at: new Date().toISOString() })
      .eq('id', codeToActivate.id);

    if (updateCodeError) {
      // This is problematic, user is enrolled but code not marked. Needs monitoring/manual fix.
      console.error("Critical: Failed to mark activation code as used after enrollment:", updateCodeError);
      toast({ title: "Warning", description: "Course enrolled, but there was an issue finalizing code. Contact support if problems persist.", variant: "default"});
    }
    
    const activatedCourseDetails = targetCourseId === codeToActivate.course_id ? targetCourse : await supabase.from('lms_courses').select('title').eq('id', codeToActivate.course_id).single().then(res => res.data);

    setMessage({type: 'success', text: `Successfully activated and enrolled in: ${activatedCourseDetails?.title || 'the course'}`});
    toast({ title: "Course Activated!", description: `You are now enrolled in ${activatedCourseDetails?.title || 'the course'}.`});
    setIsLoading(false);
    setActivationCode('');

    setTimeout(() => {
        router.push(`/lms/courses/${codeToActivate.course_id}`);
    }, 2000);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Activate LMS Course" 
        description="Enter your activation code to get access to a paid course." 
      />
      <Card className="max-w-lg mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5" /> Enter Activation Code</CardTitle>
          {targetCourse && <CardDescription>You are attempting to activate: <strong>{targetCourse.title}</strong></CardDescription>}
          {!targetCourse && <CardDescription>Enter the code provided to you after purchase.</CardDescription>}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="activationCode">Activation Code</Label>
              <Input 
                id="activationCode" 
                value={activationCode} 
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())} 
                placeholder="XXXX-XXXX-XXXX-XXXX" 
                required 
                disabled={isLoading}
              />
            </div>
             {message && (
              <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'}`}>
                {message.type === 'success' ? <CheckCircle className="inline mr-1 h-4 w-4"/> : <XCircle className="inline mr-1 h-4 w-4"/>}
                {message.text}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || !currentUserProfileId || !currentSchoolId}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {isLoading ? 'Activating...' : 'Activate Course'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
