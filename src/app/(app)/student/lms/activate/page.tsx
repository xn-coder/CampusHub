
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

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';
const MOCK_LMS_ACTIVATION_CODES_KEY = 'mockLMSActivationCodesData';

export default function ActivateLmsCoursePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activationCode, setActivationCode] = useState('');
  const [targetCourseId, setTargetCourseId] = useState<string | null>(null);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const courseIdFromQuery = searchParams.get('courseId');
    if (courseIdFromQuery) {
      setTargetCourseId(courseIdFromQuery);
      // Optionally load course details to display course name if ID is present
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      if (storedCourses) {
        const courses: Course[] = JSON.parse(storedCourses);
        const foundCourse = courses.find(c => c.id === courseIdFromQuery);
        if (foundCourse) setTargetCourse(foundCourse);
      }
    }

    if (typeof window !== 'undefined') {
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        const userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);
    }
  }, [searchParams]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!activationCode.trim()) {
      toast({ title: "Error", description: "Please enter an activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (!currentUserId || !currentUserRole) {
      toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive"});
      setIsLoading(false);
      return;
    }

    const allCodes: CourseActivationCode[] = JSON.parse(localStorage.getItem(MOCK_LMS_ACTIVATION_CODES_KEY) || '[]');
    const codeToActivate = allCodes.find(c => c.code === activationCode.trim());

    if (!codeToActivate) {
      setMessage({type: 'error', text: "Invalid activation code."});
      toast({ title: "Activation Failed", description: "Invalid activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (codeToActivate.isUsed) {
      setMessage({type: 'error', text: "This activation code has already been used."});
      toast({ title: "Activation Failed", description: "This activation code has already been used.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    
    // Mark code as used
    const updatedCodes = allCodes.map(c => 
      c.id === codeToActivate.id ? { ...c, isUsed: true, usedByUserId: currentUserId } : c
    );
    localStorage.setItem(MOCK_LMS_ACTIVATION_CODES_KEY, JSON.stringify(updatedCodes));

    // Enroll user in course
    const allCourses: Course[] = JSON.parse(localStorage.getItem(MOCK_LMS_COURSES_KEY) || '[]');
    const updatedCourses = allCourses.map(course => {
      if (course.id === codeToActivate.courseId) {
        const enrollmentArray = currentUserRole === 'student' ? 'enrolledStudentIds' : 'enrolledTeacherIds';
        if (!course[enrollmentArray].includes(currentUserId)) {
          return { ...course, [enrollmentArray]: [...course[enrollmentArray], currentUserId] };
        }
      }
      return course;
    });
    localStorage.setItem(MOCK_LMS_COURSES_KEY, JSON.stringify(updatedCourses));
    
    const activatedCourseDetails = allCourses.find(c => c.id === codeToActivate.courseId);
    setMessage({type: 'success', text: `Successfully activated and enrolled in: ${activatedCourseDetails?.title || 'the course'}`});
    toast({ title: "Course Activated!", description: `You are now enrolled in ${activatedCourseDetails?.title || 'the course'}.`});
    setIsLoading(false);
    setActivationCode(''); // Clear input

    // Optional: Redirect after a delay
    setTimeout(() => {
        router.push('/lms/available-courses');
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
          {targetCourse && <CardDescription>You are activating: <strong>{targetCourse.title}</strong></CardDescription>}
          {!targetCourse && <CardDescription>Enter the code provided to you after purchase.</CardDescription>}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="activationCode">Activation Code</Label>
              <Input 
                id="activationCode" 
                value={activationCode} 
                onChange={(e) => setActivationCode(e.target.value)} 
                placeholder="XXXX-XXXX-XXXX-XXXX" 
                required 
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {isLoading ? 'Activating...' : 'Activate Course'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
