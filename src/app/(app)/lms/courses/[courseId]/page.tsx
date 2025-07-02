
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ExternalLink, AlertTriangle, Loader2, Award, Lock, BookOpen, Video, FileText, Users } from 'lucide-react';
import type { Course, CourseResource, UserRole, LmsLesson } from '@/types';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { getCourseDetailsForViewingAction, checkUserEnrollmentForCourseViewAction, markLessonAsCompleteAction } from './actions';

interface EnrichedLmsLesson extends LmsLesson {
    resources: CourseResource[];
    is_completed?: boolean;
}

export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<(Course & { lessons: EnrichedLmsLesson[] }) | null>(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isMarkingComplete, setIsMarkingComplete] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setPageError(null);

      const userId = localStorage.getItem('currentUserId');
      const role = localStorage.getItem('currentUserRole') as UserRole | null;
      if (!userId || !role) {
        setPageError("User session information is missing. Please log in again.");
        setIsLoading(false);
        return;
      }
      
      const enrollmentResult = await checkUserEnrollmentForCourseViewAction(courseId, userId, role);
      if (!enrollmentResult.ok) {
        setPageError(enrollmentResult.message || "Could not verify enrollment status.");
        setIsLoading(false);
        return;
      }

      setIsEnrolled(enrollmentResult.isEnrolled);

      if (!enrollmentResult.isEnrolled) {
        setIsLoading(false);
        return;
      }
      
      // Only students have profiles and progress to track
      const studentId = role === 'student' ? enrollmentResult.studentProfileId : 'non-student-viewer';
      if (!studentId) {
        if (role === 'student') {
          setPageError("Could not retrieve student profile for progress tracking.");
          setIsLoading(false);
          return;
        }
      }
      setStudentProfileId(studentId);
      
      const courseResult = await getCourseDetailsForViewingAction(courseId, studentId);
      
      if (courseResult.ok && courseResult.course) {
        setCourse(courseResult.course);
        if (courseResult.progress) {
          setProgress(courseResult.progress);
        }
      } else {
        setPageError(courseResult.message || "Failed to load course details.");
      }
      
      setIsLoading(false);
  }, [courseId, toast]);


  useEffect(() => {
    if (courseId) {
      fetchData();
    }
  }, [courseId, fetchData]);
  
  const handleMarkLessonComplete = async (lessonId: string) => {
    if (!studentProfileId || studentProfileId === 'non-student-viewer') {
      toast({ title: "Action not applicable", description: "Progress can only be tracked for students.", variant: "default"});
      return;
    }
    
    setIsMarkingComplete(prev => ({ ...prev, [lessonId]: true }));
    const result = await markLessonAsCompleteAction({
        student_id: studentProfileId,
        lesson_id: lessonId,
        course_id: courseId,
    });
    
    if (result.ok) {
        toast({ title: "Progress Saved!", description: result.message });
        await fetchData(); // Re-fetch all data to update progress bar and UI
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsMarkingComplete(prev => ({ ...prev, [lessonId]: false }));
  };
  
  const getResourceIcon = (type: string) => {
    switch(type) {
      case 'ebook': return <BookOpen className="mr-2 h-4 w-4 text-primary" />;
      case 'video': return <Video className="mr-2 h-4 w-4 text-primary" />;
      case 'note': return <FileText className="mr-2 h-4 w-4 text-primary" />;
      case 'webinar': return <Users className="mr-2 h-4 w-4 text-primary" />;
      default: return null;
    }
  };


  if (isLoading) {
    return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading course content...</div>;
  }

  if (pageError) {
    return <div className="text-center py-10 text-destructive">{pageError}</div>;
  }
  
  if (!isEnrolled) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-[60vh]">
        <PageHeader title="Access Denied" />
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center"><Lock className="mr-2 h-6 w-6 text-destructive" /> Not Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You are not enrolled in "{course?.title || 'this course'}". Please enroll or activate the course to view its content.</p>
            <Button asChild className="mt-4">
              <Link href="/lms/available-courses">Back to Available Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course data could not be loaded.</div>;
  }
  
  const isCompleted = progress.percentage === 100;
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={course.title} description={course.description || "No description available."} />
      
      {studentProfileId !== 'non-student-viewer' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>{progress.completed} of {progress.total} lessons completed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progress.percentage} className="w-full" />
             {isCompleted && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-center p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Award className="h-10 w-10 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">Congratulations! You've completed the course!</h3>
                  <p className="text-sm text-green-600 dark:text-green-400">You can now generate your certificate of completion.</p>
                </div>
                <Button asChild>
                  <Link href={`/lms/courses/${course.id}/certificate?studentName=${localStorage.getItem('currentUserName')}&courseName=${course.title}&schoolName=${'CampusHub School'}&completionDate=${new Date().toISOString()}`}>
                    Generate Certificate
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <h2 className="text-2xl font-bold mt-4">Course Lessons</h2>
      
      {course.lessons.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
            {course.lessons.map(lesson => (
                <AccordionItem value={lesson.id} key={lesson.id}>
                    <AccordionTrigger className="text-lg">
                      <div className="flex items-center">
                        {lesson.is_completed ? <CheckCircle className="h-5 w-5 mr-3 text-green-500" /> : <div className="h-5 w-5 mr-3 rounded-full border-2 border-muted-foreground"/>}
                        {lesson.title}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 space-y-4">
                        {lesson.resources.map(resource => (
                            <div key={resource.id} className="p-4 border rounded-md hover:shadow-sm transition-shadow">
                                <h4 className="font-semibold flex items-center">{getResourceIcon(resource.type)} {resource.title}</h4>
                                {resource.type === 'note' ? (
                                    <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-sm">
                                        {resource.url_or_content}
                                    </div>
                                ) : (
                                    <a href={resource.url_or_content} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-primary hover:underline flex items-center">
                                        Access Resource <ExternalLink className="ml-1 h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        ))}
                        {studentProfileId !== 'non-student-viewer' && !lesson.is_completed && (
                            <div className="pt-4 text-right">
                                <Button onClick={() => handleMarkLessonComplete(lesson.id)} disabled={isMarkingComplete[lesson.id]}>
                                    {isMarkingComplete[lesson.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                    Mark as Complete
                                </Button>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      ) : (
        <Card>
            <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">No lessons have been added to this course yet.</p>
            </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={() => router.push('/lms/available-courses')} className="mt-4 self-start">
        Back to Available Courses
      </Button>
    </div>
  );
}
