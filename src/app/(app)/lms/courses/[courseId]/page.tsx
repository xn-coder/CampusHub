

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Lock, Loader2, BookOpen, Video, FileText, Users, Award, FileQuestion } from 'lucide-react';
import type { Course, CourseResource, UserRole, LessonContentResource } from '@/types';
import Link from 'next/link';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";

export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<(Course & { resources: CourseResource[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  
  const [completedResources, setCompletedResources] = useState<Record<string, boolean>>({});
  const [videoCompletionStatus, setVideoCompletionStatus] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);

  const [currentStudentName, setCurrentStudentName] = useState<string>('');
  const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
  const [openLessons, setOpenLessons] = useState<string[]>([]);
  const [viewingResource, setViewingResource] = useState<LessonContentResource | null>(null);


  const loadProgress = useCallback(() => {
    if (typeof window !== 'undefined') {
      const storedProgress = localStorage.getItem(`progress_${courseId}`);
      if (storedProgress) {
        setCompletedResources(JSON.parse(storedProgress));
      }
    }
  }, [courseId]);

  const saveProgress = useCallback((newProgress: Record<string, boolean>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`progress_${courseId}`, JSON.stringify(newProgress));
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
  }, [courseId]);


  useEffect(() => {
    if (courseId) {
      fetchData();
      loadProgress();
    }
  }, [courseId, fetchData, loadProgress]);

  useEffect(() => {
    if (!course) return;

    // A lesson is a resource of type 'note' that contains other resources
    const lessons = course.resources.filter(r => r.type === 'note');
    if (lessons.length === 0) {
      setProgress(100); // If no lessons, course is complete
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
        setProgress(100);
        return;
    }

    const completedCount = allLessonContents.filter(res => completedResources[res.id]).length;
    const newProgress = Math.round((completedCount / allLessonContents.length) * 100);
    setProgress(newProgress);

  }, [completedResources, course]);

  const handleVideoEnded = (resourceId: string) => {
    setVideoCompletionStatus(prev => ({ ...prev, [resourceId]: true }));
    toast({ title: "Video Completed!", description: "You can now mark this item as done." });
  };

  const toggleResourceCompletion = (resourceId: string) => {
    const newCompleted = { ...completedResources, [resourceId]: !completedResources[resourceId] };
    setCompletedResources(newCompleted);
    saveProgress(newCompleted);
  };
  
  const handleViewResource = (resource: LessonContentResource) => {
    setViewingResource(resource);
  };

  const getResourceIcon = (type: string) => {
    const props = { className: "mr-3 h-5 w-5 text-primary shrink-0" };
    switch(type) {
      case 'ebook': return <BookOpen {...props} />;
      case 'video': return <Video {...props} />;
      case 'note': return <FileText {...props} />;
      case 'webinar': return <Users {...props} />;
      case 'quiz': return <FileQuestion {...props} />;
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

  const handleStartCourse = () => {
    if (lessons.length > 0) {
      setOpenLessons([lessons[0].id]);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title={course.title} 
        description={course.description || "No description available."}
        actions={
            lessons.length > 0 ? <Button onClick={handleStartCourse}>Start Course</Button> : null
        }
      />
      
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
                    <Link href={`${pathname}/certificate?studentName=${encodeURIComponent(currentStudentName)}&courseName=${encodeURIComponent(course.title)}&schoolName=${encodeURIComponent(currentSchoolName)}&completionDate=${new Date().toISOString()}`}>
                        <Award className="mr-2 h-4 w-4" /> Generate Certificate
                    </Link>
                </Button>
            </CardFooter>
        )}
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>Work your way through the lessons below.</CardDescription>
          </CardHeader>
          <CardContent>
            {lessons.length > 0 ? (
                <Accordion 
                    type="multiple" 
                    className="w-full space-y-2"
                    value={openLessons}
                    onValueChange={setOpenLessons}
                >
                 {lessons.map(lesson => {
                    const lessonContents: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]');
                    return (
                        <AccordionItem value={lesson.id} key={lesson.id} className="border rounded-md">
                            <AccordionTrigger className="px-4 hover:no-underline font-semibold text-lg">
                                {lesson.title}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pt-2 border-t">
                               <div className="space-y-2 py-2">
                                   {lessonContents.length > 0 ? lessonContents.map(res => (
                                       <div key={res.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <Button
                                                variant="ghost"
                                                className="flex-grow justify-start text-left h-auto p-1 font-medium"
                                                onClick={() => handleViewResource(res)}
                                            >
                                                <div className="flex items-center">
                                                    {getResourceIcon(res.type)}
                                                    <span>{res.title}</span>
                                                </div>
                                            </Button>
                                            <div className="flex items-center space-x-2 pl-4 shrink-0">
                                                <Checkbox
                                                    id={`res-complete-${res.id}`}
                                                    checked={!!completedResources[res.id]}
                                                    onCheckedChange={() => toggleResourceCompletion(res.id)}
                                                    disabled={res.type === 'video' && !videoCompletionStatus[res.id]}
                                                />
                                                <Label htmlFor={`res-complete-${res.id}`} className="text-xs">Done</Label>
                                            </div>
                                       </div>
                                   )) : <p className="text-sm text-muted-foreground text-center py-2">This lesson is empty.</p>}
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

       <Dialog open={!!viewingResource} onOpenChange={(open) => !open && setViewingResource(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewingResource?.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4 overflow-y-auto flex-grow">
              {viewingResource?.type === 'video' && (
                <video key={viewingResource.id} controls autoPlay src={viewingResource.url_or_content} className="w-full rounded-md" onEnded={() => handleVideoEnded(viewingResource!.id)}>
                  Your browser does not support the video tag.
                </video>
              )}
              {viewingResource?.type === 'note' && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingResource.url_or_content}</p>
              )}
              {viewingResource?.type === 'ebook' && (
                  <a href={viewingResource.url_or_content} target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:underline flex items-center">
                    <BookOpen className="mr-2 h-5 w-5"/> Click here to open E-book in a new tab
                  </a>
              )}
              {viewingResource?.type === 'webinar' && (
                  <a href={viewingResource.url_or_content} target="_blank" rel="noopener noreferrer" className="text-lg text-primary hover:underline flex items-center">
                    <Users className="mr-2 h-5 w-5"/> Click here to join the Webinar
                  </a>
              )}
              {viewingResource?.type === 'quiz' && (
                  <div>
                    <p>Quiz functionality will be displayed here.</p>
                  </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingResource(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      <Button variant="outline" onClick={() => router.push('/lms/available-courses')} className="mt-4 self-start">
        Back to Available Courses
      </Button>
    </div>
  );
}
