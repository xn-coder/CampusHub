
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Video, FileText, Users, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import type { Course, CourseResource, UserRole, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { getCourseDetailsForViewingAction, checkUserEnrollmentForCourseViewAction } from './actions';


type ResourceTabKey = 'ebooks' | 'videos' | 'notes' | 'webinars';

const getResourceTypeLabel = (type: CourseResourceType | ResourceTabKey): string => {
    // Normalize type if it's a tab key
    const normalizedType = type === 'ebooks' ? 'ebook' :
                           type === 'videos' ? 'video' :
                           type === 'notes' ? 'note' :
                           type === 'webinars' ? 'webinar' : type;
    switch(normalizedType) {
        case 'ebook': return 'E-Book';
        case 'video': return 'Video';
        case 'note': return 'Note';
        case 'webinar': return 'Webinar/Link';
        default: return 'Resource';
    }
}


export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false); 
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); 
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    console.log("[Course Detail Page] Effect 1: Initializing user context fetch.");
    let cUserId: string | null = null;
    let cUserRole: UserRole | null = null;
    if (typeof window !== 'undefined') {
        cUserId = localStorage.getItem('currentUserId');
        cUserRole = localStorage.getItem('currentUserRole') as UserRole | null;
    }
    setCurrentUserId(cUserId);
    setCurrentUserRole(cUserRole);
    console.log(`[Course Detail Page] Effect 1: Basic context fetched - UserID: ${cUserId}, Role: ${cUserRole}`);
    
    // Set loading to false only after initial context is set, next effect will handle data loading
    // This helps ensure the second effect has the IDs it needs.
  }, []);


  const fetchCourseAndEnrollmentData = useCallback(async () => {
    if (!courseId || !currentUserId || !currentUserRole) {
      console.log("[Course Detail Page] Fetch prerequisites not met:", { courseId, currentUserId, currentUserRole });
      setIsLoadingCourse(false);
      setIsLoadingEnrollment(false);
      if(!currentUserId || !currentUserRole) { // If user context is missing, show error
        toast({ title: "Error", description: "User context not found. Cannot load course.", variant: "destructive" });
      }
      return;
    }

    console.log(`[Course Detail Page] Fetching course and enrollment data for CourseID: ${courseId}, UserID: ${currentUserId}, Role: ${currentUserRole}`);
    setIsLoadingCourse(true);
    setIsLoadingEnrollment(true);

    try {
      const [courseResult, enrollmentResult] = await Promise.all([
        getCourseDetailsForViewingAction(courseId),
        checkUserEnrollmentForCourseViewAction(courseId, currentUserId, currentUserRole)
      ]);

      if (courseResult.ok && courseResult.course) {
        setCourse(courseResult.course);
      } else {
        toast({ title: "Error Loading Course", description: courseResult.message || "Failed to load course details.", variant: "destructive" });
        setCourse(null);
      }

      if (enrollmentResult.ok) {
        setIsEnrolled(enrollmentResult.isEnrolled);
        console.log(`[Course Detail Page] Enrollment status for UserID ${currentUserId} in CourseID ${courseId}: ${enrollmentResult.isEnrolled}`);
      } else {
        toast({ title: "Error Checking Enrollment", description: enrollmentResult.message || "Failed to verify enrollment status.", variant: "destructive" });
        setIsEnrolled(false);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
      setCourse(null);
      setIsEnrolled(false);
    } finally {
      setIsLoadingCourse(false);
      setIsLoadingEnrollment(false);
    }
  }, [courseId, currentUserId, currentUserRole, toast]);

  useEffect(() => {
    // This effect runs when courseId, currentUserId, or currentUserRole changes.
    // It ensures that fetchCourseAndEnrollmentData is called once these dependencies are stable.
    if (courseId && currentUserId && currentUserRole) {
      fetchCourseAndEnrollmentData();
    } else if (!currentUserId || !currentUserRole) {
      // If user context is still missing after the first effect, we shouldn't proceed to fetch.
      // The page will show a loading state or an error based on how isLoading states are handled.
      setIsLoadingCourse(false); // No user context, nothing to load
      setIsLoadingEnrollment(false);
    }
  }, [courseId, currentUserId, currentUserRole, fetchCourseAndEnrollmentData]);


  if (isLoadingCourse || isLoadingEnrollment) {
    return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading course content...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found or an error occurred while loading.</div>;
  }
  
  if (!currentUserId || !currentUserRole) {
     return <div className="text-center py-10 text-destructive">User session information is missing. Please log in again.</div>;
  }


  if (!isEnrolled && (currentUserRole === 'student' || currentUserRole === 'teacher')) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-[60vh]">
        <PageHeader title="Access Denied" />
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center"><AlertTriangle className="mr-2 h-6 w-6 text-destructive" /> Not Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You are not enrolled in "{course.title}". Please enroll or activate the course to view its content.</p>
            <Button asChild className="mt-4">
              <Link href="/lms/available-courses">Back to Available Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={course.title} description={course.description || "No description available."} />
      
      <Tabs defaultValue="ebooks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="ebooks"><BookOpen className="mr-2 h-4 w-4" /> E-books ({course.resources?.ebooks?.length || 0})</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" /> Videos ({course.resources?.videos?.length || 0})</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="mr-2 h-4 w-4" /> Notes ({course.resources?.notes?.length || 0})</TabsTrigger>
          <TabsTrigger value="webinars"><Users className="mr-2 h-4 w-4" /> Webinars ({course.resources?.webinars?.length || 0})</TabsTrigger>
        </TabsList>

        {(['ebooks', 'videos', 'notes', 'webinars'] as ResourceTabKey[]).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <CardTitle>{getResourceTypeLabel(tabKey as CourseResourceType)}</CardTitle>
                <CardDescription>Available {tabKey.toLowerCase()} for this course.</CardDescription>
              </CardHeader>
              <CardContent>
                {(course.resources?.[tabKey]?.length ?? 0) > 0 ? (
                  <ul className="space-y-3">
                    {(course.resources?.[tabKey] || []).map((res: CourseResource) => (
                      <li key={res.id} className="p-4 border rounded-md hover:shadow-md transition-shadow">
                        <h4 className="font-semibold text-lg">{res.title}</h4>
                        {res.type === 'note' ? (
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-sm max-h-48 overflow-y-auto">
                            {res.url_or_content}
                          </div>
                        ) : (
                          <a 
                            href={res.url_or_content} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-1 text-sm text-primary hover:underline flex items-center"
                          >
                            Access {getResourceTypeLabel(tabKey as CourseResourceType)} <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No {tabKey.toLowerCase()} available for this course yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
       <Button variant="outline" onClick={() => router.push('/lms/available-courses')} className="mt-4 self-start">
        Back to Available Courses
      </Button>
    </div>
  );
}

