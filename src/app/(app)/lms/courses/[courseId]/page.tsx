
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
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false); 
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setPageError(null);

      const userId = localStorage.getItem('currentUserId');
      const role = localStorage.getItem('currentUserRole') as UserRole | null;

      if (!userId || !role) {
        setPageError("User session information is missing. Please log in again.");
        setIsLoading(false);
        return;
      }
      setUserRole(role); // Set role for UI logic

      try {
        const [courseResult, enrollmentResult] = await Promise.all([
          getCourseDetailsForViewingAction(courseId),
          checkUserEnrollmentForCourseViewAction(courseId, userId, role)
        ]);

        if (!courseResult.ok) {
          throw new Error(courseResult.message || "Failed to load course details.");
        }
        setCourse(courseResult.course!);

        if (!enrollmentResult.ok) {
          // This might not be a critical error if the user is an admin, but we'll show a warning.
          toast({ title: "Warning", description: enrollmentResult.message || "Could not verify enrollment status.", variant: "destructive" });
          setIsEnrolled(false);
        } else {
          setIsEnrolled(enrollmentResult.isEnrolled);
        }

      } catch (error: any) {
        setPageError(error.message);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setCourse(null);
        setIsEnrolled(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId) {
      fetchData();
    }
  }, [courseId, toast]);

  if (isLoading) {
    return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading course content...</div>;
  }

  if (pageError) {
    return <div className="text-center py-10 text-destructive">{pageError}</div>;
  }
  
  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found or an error occurred while loading.</div>;
  }
  
  if (!isEnrolled) {
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
                        {res.type === 'note' && !res.file_name ? (
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

