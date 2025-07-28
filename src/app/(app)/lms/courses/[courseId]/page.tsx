

"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Lock, Loader2, BookOpen, Video, FileText, Users, Award, FileQuestion, CheckCircle, Presentation, Eye } from 'lucide-react';
import type { Course, CourseResource, UserRole, LessonContentResource } from '@/types';
import Link from 'next/link';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";

function ViewCoursePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  const isPreview = searchParams.get('preview') === 'true';

  const [course, setCourse] = useState<(Course & { resources: CourseResource[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  
  const [completedResources, setCompletedResources] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);

  const [currentStudentName, setCurrentStudentName] = useState<string>('');
  const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
  const [openLessons, setOpenLessons] = useState<string[]>([]);


  const loadProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      const storedProgress = localStorage.getItem(`progress_${courseId}`);
      if (storedProgress) {
        setCompletedResources(JSON.parse(storedProgress));
      }
    }
  }, [courseId]);


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
      
      const enrollmentResult = await checkUserEnrollmentForCourseViewAction(courseId, userId, role, isPreview);
      if (!enrollmentResult.ok) {
        setPageError(enrollmentResult.message || "Could not verify enrollment status.");
        setIsLoading(false);
        return;
      }

      setIsEnrolled(enrollmentResult.isEnrolled);

      if (!enrollmentResult.isEnrolled && !isPreview) {
        setIsLoading(false);
        return;
      }
      
      const courseResult = await getCourseForViewingAction(courseId);
      
      if (courseResult.ok && courseResult.course) {
        setCourse(courseResult.course);
        // Fetch user and school name for certificate
        const { data: user } = await supabase.from('users').select('name, school_id').eq('id', userId).single();
        setCurrentStudentName(user?.name || 'Valued Student');
        if (user?.school_id) {
          const { data: school } = await supabase.from('schools').select('name').eq('id', user.school_id).single();
          setCurrentSchoolName(school?.name || 'CampusHub');
        } else {
            setCurrentSchoolName('CampusHub');
        }
      } else {
        setPageError(courseResult.message || "Failed to load course details.");
      }
      
      setIsLoading(false);
  }, [courseId, toast, isPreview]);


  useEffect(() => {
    if (courseId) {
      fetchData();
      if (!isPreview) {
        loadProgress();
      }
    }
  }, [courseId, fetchData, loadProgress, isPreview]);

  useEffect(() => {
    if (!course || isPreview) return;

    const lessons = course.resources.filter(r => r.type === 'note');
    if (lessons.length === 0) {
      setProgress(0);
      return;
    }

    const allLessonContents = lessons.flatMap(lesson => {
      try {
        const content = JSON.parse(lesson.url_or_content || '[]');
        return Array.isArray(content) ? content as LessonContentResource[] : [];
      } catch {
        return [];
      }
    });

    if(allLessonContents.length === 0) {
        setProgress(0);
        return;
    }

    const completedCount = allLessonContents.filter(res => completedResources[res.id]).length;
    const newProgress = Math.round((completedCount / allLessonContents.length) * 100);
    setProgress(newProgress);

  }, [completedResources, course, isPreview]);

  const getResourceIcon = (type: string) => {
    const props = { className: "mr-3 h-5 w-5 text-primary shrink-0" };
    switch(type) {
      case 'ebook': return <BookOpen {...props} />;
      case 'video': return <Video {...props} />;
      case 'note': return <FileText {...props} />;
      case 'webinar': return <Users {...props} />;
      case 'quiz': return <FileQuestion {...props} />;
      case 'ppt': return <Presentation {...props} />;
      default: return null;
    }
  };

  const handleStartCourse = () => {
    if (lessons.length > 0) {
      setOpenLessons([lessons[0].id]);
    }
  };
  
  if (isLoading) {
    return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading course content...</div>;
  }

  if (pageError) {
    return <div className="text-center py-10 text-destructive">{pageError}</div>;
  }
  
  if (!isEnrolled && !isPreview) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-[60vh]">
        <PageHeader title="Access Denied" />
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center"><Lock className="mr-2 h-6 w-6 text-destructive" /> Not Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You are not enrolled in this course. Please enroll or activate the course to view its content.</p>
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
  
  const lessons = course.resources.filter(r => r.type === 'note');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title={course.title} 
        description={course.description || "No description available."}
        actions={
            lessons.length > 0 && !isPreview ? <Button onClick={handleStartCourse}>Start Course</Button> : null
        }
      />
      
      {!isPreview && (
        <Card>
            <CardHeader>
                <CardTitle>Course Progress</CardTitle>
                <div className="flex items-center gap-4 pt-2">
                    <Progress value={progress} className="flex-1"/>
                    <span className="font-bold text-lg">{progress}% Complete</span>
                </div>
            </CardHeader>
            {progress === 100 && (
                <CardFooter>
                     <Button asChild>
                        <Link href={`/lms/courses/${courseId}/certificate?studentName=${encodeURIComponent(currentStudentName)}&courseName=${encodeURIComponent(course.title)}&schoolName=${encodeURIComponent(currentSchoolName)}&completionDate=${new Date().toISOString()}`}>
                            <Award className="mr-2 h-4 w-4" /> Generate Certificate
                        </Link>
                    </Button>
                </CardFooter>
            )}
        </Card>
      )}

      <Card>
          <CardHeader>
              <CardTitle>{isPreview ? 'Course Preview' : 'Course Content'}</CardTitle>
              <CardDescription>{isPreview ? 'This is a preview. Enroll to access the content.' : 'Work your way through the lessons below.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {lessons.length > 0 ? (
                <Accordion 
                    type="multiple" 
                    className="w-full space-y-2"
                    value={openLessons}
                    onValueChange={setOpenLessons}
                >
                 {lessons.map((lesson, lessonIndex) => {
                    const lessonContents: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]');
                    const isFirstLessonPreview = isPreview && course.is_paid && lessonIndex === 0;

                    return (
                        <AccordionItem value={lesson.id} key={lesson.id} className="border rounded-md">
                            <AccordionTrigger className="px-4 hover:no-underline font-semibold text-lg">
                                {lesson.title}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pt-2 border-t">
                               <div className="space-y-2 py-2">
                                   {lessonContents.length > 0 ? lessonContents.map(res => {
                                       const isLocked = isPreview && !isFirstLessonPreview;
                                       return (
                                           <div key={res.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors">
                                                <Link href={isLocked ? '#' : `/lms/courses/${courseId}/${res.id}`} className={`flex-grow ${isLocked ? 'cursor-not-allowed' : ''}`}>
                                                    <div className="flex items-center p-1 font-medium">
                                                        {getResourceIcon(res.type)}
                                                        <span className={isLocked ? 'text-muted-foreground' : ''}>{res.title}</span>
                                                    </div>
                                                </Link>
                                                <div className="flex items-center space-x-2 pl-4 shrink-0">
                                                    {isLocked ? <Lock className="h-5 w-5 text-muted-foreground" /> :
                                                    !isPreview && completedResources[res.id] && (
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                    )}
                                                </div>
                                           </div>
                                       );
                                   }) : <p className="text-sm text-muted-foreground text-center py-2">This lesson is empty.</p>}
                               </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                 })}
                </Accordion>
            ) : (
              <p className="text-muted-foreground text-center py-4">No lessons have been added to this course yet.</p>
            )}
          </CardContent>
      </Card>

      <Button variant="outline" onClick={() => router.push('/lms/available-courses')} className="mt-4 self-start">
        Back to Available Courses
      </Button>
    </div>
  );
}

export default function ViewCoursePage() {
    return (
        <Suspense>
            <ViewCoursePageContent />
        </Suspense>
    )
}
