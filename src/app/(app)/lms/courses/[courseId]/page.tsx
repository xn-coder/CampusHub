
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Video, FileText, Users, ExternalLink, AlertTriangle } from 'lucide-react';
import type { Course, CourseResource, UserRole } from '@/types';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';
type ResourceType = 'ebooks' | 'videos' | 'notes' | 'webinars';

export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (courseId && typeof window !== 'undefined') {
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      const courses: Course[] = storedCourses ? JSON.parse(storedCourses) : [];
      const foundCourse = courses.find(c => c.id === courseId);
      
      if (foundCourse) {
        setCourse(foundCourse);
        const currentUserId = localStorage.getItem('currentUserId');
        const currentUserRole = localStorage.getItem('currentUserRole') as UserRole | null;
        if (currentUserId && currentUserRole) {
          const enrollmentArrayKey = currentUserRole === 'student' ? 'enrolledStudentIds' : 'enrolledTeacherIds';
          const enrolledIds = foundCourse[enrollmentArrayKey] || [];
          setIsEnrolled(enrolledIds.includes(currentUserId));
        }
      } else {
        toast({ title: "Error", description: "Course not found.", variant: "destructive" });
        // router.push('/lms/available-courses'); // Redirect if course doesn't exist
      }
      setIsLoading(false);
    }
  }, [courseId, router, toast]);

  if (isLoading) {
    return <div className="text-center py-10">Loading course content...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found or error loading data.</div>;
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

  const getResourceTypeLabel = (type: ResourceType): string => {
    switch(type) {
        case 'ebooks': return 'E-Book';
        case 'videos': return 'Video';
        case 'notes': return 'Note';
        case 'webinars': return 'Webinar';
        default: return 'Resource';
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={course.title} description={course.description} />
      
      <Tabs defaultValue="ebooks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ebooks"><BookOpen className="mr-2 h-4 w-4" /> E-books</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" /> Videos</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="mr-2 h-4 w-4" /> Notes</TabsTrigger>
          <TabsTrigger value="webinars"><Users className="mr-2 h-4 w-4" /> Webinars</TabsTrigger>
        </TabsList>

        {(['ebooks', 'videos', 'notes', 'webinars'] as ResourceType[]).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <CardTitle>{getResourceTypeLabel(tabKey)}s</CardTitle>
                <CardDescription>Available {tabKey.toLowerCase()} for this course.</CardDescription>
              </CardHeader>
              <CardContent>
                {(course.resources?.[tabKey]?.length ?? 0) > 0 ? (
                  <ul className="space-y-3">
                    {course.resources[tabKey].map((res: CourseResource) => (
                      <li key={res.id} className="p-4 border rounded-md hover:shadow-md transition-shadow">
                        <h4 className="font-semibold text-lg">{res.title}</h4>
                        {res.type === 'note' ? (
                          <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-sm">
                            {res.urlOrContent}
                          </div>
                        ) : (
                          <a 
                            href={res.urlOrContent} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-1 text-sm text-primary hover:underline flex items-center"
                          >
                            Access {getResourceTypeLabel(tabKey)} <ExternalLink className="ml-1 h-3 w-3" />
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
