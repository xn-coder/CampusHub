
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Course, UserRole } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, CheckCircle, XCircle, Loader2 } from 'lucide-react';
// import { supabase } from '@/lib/supabaseClient'; // Removed direct supabase client
import { getCourseActivationPageInitialDataAction, activateCourseWithCodeAction } from '@/app/(app)/admin/lms/courses/actions';

export default function ActivateLmsCoursePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activationCode, setActivationCode] = useState('');
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); 
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); 
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const fetchInitialPageData = useCallback(async () => {
    setIsPageLoading(true);
    const courseIdFromQuery = searchParams.get('courseId');
    const userIdFromStorage = localStorage.getItem('currentUserId');

    if (!userIdFromStorage) {
      toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive"});
      setIsPageLoading(false);
      return;
    }
    setCurrentUserId(userIdFromStorage);

    const result = await getCourseActivationPageInitialDataAction(courseIdFromQuery, userIdFromStorage);

    if (result.ok && result.data) {
      setTargetCourse(result.data.targetCourse || null);
      setCurrentUserProfileId(result.data.userProfileId || null);
      setCurrentSchoolId(result.data.userSchoolId || null);
      setCurrentUserRole(result.data.userRole || null);
    } else {
      toast({ title: "Error Loading Page Data", description: result.message || "Failed to load initial page data.", variant: "destructive"});
    }
    setIsPageLoading(false);
  }, [searchParams, toast]);

  useEffect(() => {
    fetchInitialPageData();
  }, [fetchInitialPageData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!activationCode.trim()) {
      toast({ title: "Error", description: "Please enter an activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (!currentUserProfileId || !currentUserRole || !currentSchoolId || !currentUserId) {
      toast({ title: "Error", description: "User profile or school context is missing. Cannot activate course.", variant: "destructive"});
      setIsLoading(false);
      return;
    }

    const finalActivationCode = activationCode.trim().toUpperCase();

    const result = await activateCourseWithCodeAction({
      activationCode: finalActivationCode,
      userProfileId: currentUserProfileId,
      userId: currentUserId,
      userRole: currentUserRole,
      schoolId: currentSchoolId,
    });

    if (result.ok && result.activatedCourse) {
      setMessage({type: 'success', text: result.message});
      toast({ title: "Course Activated!", description: result.message });
      setActivationCode('');
      setTimeout(() => {
          router.push(`/lms/courses/${result.activatedCourse!.id}`);
      }, 2000);
    } else {
      setMessage({type: 'error', text: result.message});
      toast({ title: "Activation Failed", description: result.message, variant: "destructive"});
    }
    setIsLoading(false);
  };

  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Activate LMS Course" />
            <Card className="max-w-lg mx-auto w-full">
                <CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading page data...
                </CardContent>
            </Card>
        </div>
    );
  }


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
                disabled={isLoading || isPageLoading}
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
            <Button type="submit" className="w-full" disabled={isLoading || isPageLoading || !currentUserProfileId || !currentSchoolId}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {isLoading ? 'Activating...' : 'Activate Course'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

