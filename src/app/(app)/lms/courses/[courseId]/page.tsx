
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Lock, Loader2, BookOpen, Video, FileText, Users } from 'lucide-react';
import type { Course, CourseResource, UserRole } from '@/types';
import Link from 'next/link';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction } from './actions';

export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<(Course & { resources: CourseResource[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

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
      } else {
        setPageError(courseResult.message || "Failed to load course details.");
      }
      
      setIsLoading(false);
  }, [courseId]);


  useEffect(() => {
    if (courseId) {
      fetchData();
    }
  }, [courseId, fetchData]);

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
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={course.title} description={course.description || "No description available."} />
      
      <Card>
          <CardHeader>
              <CardTitle>Course Resources</CardTitle>
              <CardDescription>All materials available for this course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
              {course.resources.length > 0 ? (
                course.resources.map(resource => (
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
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No resources have been added to this course yet.</p>
              )}
          </CardContent>
      </Card>

      <Button variant="outline" onClick={() => router.push('/lms/available-courses')} className="mt-4 self-start">
        Back to Available Courses
      </Button>
    </div>
  );
}
