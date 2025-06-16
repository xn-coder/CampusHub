
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Video, FileText, Users, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import type { Course, CourseResource, UserRole, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ResourceTabKey = 'ebooks' | 'videos' | 'notes' | 'webinars';

const dbTypeToResourceKey: Record<CourseResourceType, ResourceTabKey> = {
  ebook: 'ebooks',
  video: 'videos',
  note: 'notes',
  webinar: 'webinars',
};


export default function ViewCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false); 
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); 
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); // This is students.id or teachers.id

  // Effect 1: Fetch basic user context (userId, role) and then specific profile ID
  useEffect(() => {
    console.log("[Course Detail Page] Effect 1: Initializing user context fetch.");
    setIsLoading(true); // Start loading early
    let profileIdFetched = false;

    async function fetchUserAndProfile() {
      if (typeof window !== 'undefined') {
          const cUserId = localStorage.getItem('currentUserId');
          const cUserRole = localStorage.getItem('currentUserRole') as UserRole | null;
          setCurrentUserId(cUserId);
          setCurrentUserRole(cUserRole);
          console.log(`[Course Detail Page] Effect 1: Basic context fetched - UserID: ${cUserId}, Role: ${cUserRole}`);

          if (cUserId && cUserRole && (cUserRole === 'student' || cUserRole === 'teacher')) {
            const profileTable = cUserRole === 'student' ? 'students' : 'teachers';
            console.log(`[Course Detail Page] Effect 1: Fetching ${cUserRole} profile from table '${profileTable}' for UserID: ${cUserId}`);
            try {
              const {data: profile, error} = await supabase.from(profileTable).select('id').eq('user_id', cUserId).single();
              if (error || !profile) {
                console.error(`[Course Detail Page] Effect 1: Error fetching ${cUserRole} profile id for UserID ${cUserId}:`, error?.message);
                toast({ title: "Context Error", description: `Could not fetch your ${cUserRole} profile. Enrollment status may be incorrect.`, variant: "destructive" });
                setCurrentUserProfileId(null); // Explicitly set to null on error
              } else {
                setCurrentUserProfileId(profile.id);
                profileIdFetched = true;
                console.log(`[Course Detail Page] Effect 1: Successfully fetched ProfileID: ${profile.id} for UserID: ${cUserId}`);
              }
            } catch (e) {
                console.error(`[Course Detail Page] Effect 1: Exception fetching profile for UserID ${cUserId}:`, e);
                setCurrentUserProfileId(null);
            }
          } else if (cUserRole === 'admin' || cUserRole === 'superadmin') {
            profileIdFetched = true; // Admins don't need a separate profile ID for this enrollment check logic
            console.log("[Course Detail Page] Effect 1: Admin/Superadmin role, no separate profile ID needed for enrollment logic.");
          } else {
            // No valid role or user ID, so no profile ID can be fetched
             console.log("[Course Detail Page] Effect 1: No valid role or user ID for profile fetch.");
          }
      }
    }
    fetchUserAndProfile();
  }, [toast]);


  // Effect 2: Fetch course data and check enrollment (depends on IDs from Effect 1)
  useEffect(() => {
    console.log(`[Course Detail Page] Effect 2: Triggered. CourseID: ${courseId}, UserID: ${currentUserId}, Role: ${currentUserRole}, ProfileID: ${currentUserProfileId}`);

    if (!courseId) {
      console.log("[Course Detail Page] Effect 2: No courseId, skipping fetch.");
      setIsLoading(false);
      return;
    }

    // Guard: Ensure all necessary IDs are available before proceeding
    if (!currentUserId || !currentUserRole) {
      console.log("[Course Detail Page] Effect 2: Waiting for basic user context (UserID/Role).");
      // setIsLoading(true) should already be set or handled by Effect 1
      return; 
    }
    if ((currentUserRole === 'student' || currentUserRole === 'teacher') && !currentUserProfileId) {
      console.log(`[Course Detail Page] Effect 2: Role is ${currentUserRole}, but waiting for ProfileID.`);
      // setIsLoading(true) should already be set or handled by Effect 1
      return;
    }
    console.log(`[Course Detail Page] Effect 2: All IDs present. Proceeding with course data fetch and enrollment check for CourseID: ${courseId}.`);


    async function fetchCourseDataAndCheckEnrollment() {
      setIsLoading(true); // Ensure loading is true for this async operation
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('lms_courses')
          .select('*')
          .eq('id', courseId)
          .single();

        if (courseError || !courseData) {
          toast({ title: "Error", description: `Course not found or failed to load: ${courseError?.message || 'Unknown error'}`, variant: "destructive" });
          setCourse(null);
          setIsEnrolled(false);
          setIsLoading(false);
          return;
        }
        
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('lms_course_resources')
          .select('*')
          .eq('course_id', courseId);

        if (resourcesError) {
          toast({ title: "Error", description: `Failed to load course resources: ${resourcesError.message}`, variant: "destructive" });
        }
        
        const groupedResources: Required<Course>['resources'] = { ebooks: [], videos: [], notes: [], webinars: [] };
        if (resourcesData) {
          resourcesData.forEach(res => {
            const key = dbTypeToResourceKey[res.type as CourseResourceType];
            if (key) {
              groupedResources[key].push(res as CourseResource);
            }
          });
        }
        
        const enrichedCourse: Course = { ...(courseData as Course), resources: groupedResources };
        setCourse(enrichedCourse);

        // Enrollment Check
        console.log(`[Course Detail Page] Effect 2: Performing enrollment check. Role: ${currentUserRole}, UserID: ${currentUserId}, ProfileID: ${currentUserProfileId}`);
        if (currentUserRole === 'admin' || currentUserRole === 'superadmin') {
          setIsEnrolled(true);
          console.log("[Course Detail Page] Effect 2: Admin/Superadmin detected, setting isEnrolled to true.");
        } else if ((currentUserRole === 'student' || currentUserRole === 'teacher') && currentUserProfileId) {
          const enrollmentTable = currentUserRole === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
          const fkColumnNameInEnrollmentTable = currentUserRole === 'student' ? 'student_id' : 'teacher_id';
          
          console.log(`[Course Detail Page] Effect 2: Checking enrollment for ${currentUserRole}: courseId=${courseId}, profileIdForCheck=${currentUserProfileId}, table=${enrollmentTable}`);
          const { data: enrollment, error: enrollmentError } = await supabase
            .from(enrollmentTable)
            .select('id')
            .eq('course_id', courseId)
            .eq(fkColumnNameInEnrollmentTable, currentUserProfileId)
            .maybeSingle(); 

          if (enrollmentError) {
            toast({ title: "Error", description: `Failed to check enrollment status: ${enrollmentError.message}`, variant: "destructive" });
            console.error(`[Course Detail Page] Effect 2: Enrollment check error for ${currentUserProfileId} in ${courseId}:`, enrollmentError);
            setIsEnrolled(false);
          } else {
            setIsEnrolled(!!enrollment);
            console.log(`[Course Detail Page] Effect 2: Enrollment status for ProfileID ${currentUserProfileId} in CourseID ${courseId}: ${!!enrollment}`);
          }
        } else {
            setIsEnrolled(false);
            console.log("[Course Detail Page] Effect 2: Enrollment check skipped or failed: Role not student/teacher or ProfileID missing.");
        }

      } catch (error: any) {
          toast({ title: "Error", description: `Failed to load course: ${error.message}`, variant: "destructive" });
          console.error("[Course Detail Page] Effect 2: Exception during course data/enrollment fetch:", error);
          setCourse(null);
          setIsEnrolled(false);
      } finally {
        setIsLoading(false);
        console.log("[Course Detail Page] Effect 2: Fetch and enrollment check finished.");
      }
    }

    fetchCourseDataAndCheckEnrollment();
  }, [courseId, currentUserId, currentUserRole, currentUserProfileId, router, toast]);


  if (isLoading) {
    return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading course content...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found or an error occurred while loading.</div>;
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

  const getResourceTypeLabel = (type: ResourceTabKey): string => {
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
      <PageHeader title={course.title} description={course.description || "No description available."} />
      
      <Tabs defaultValue="ebooks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="ebooks"><BookOpen className="mr-2 h-4 w-4" /> E-books</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" /> Videos</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="mr-2 h-4 w-4" /> Notes</TabsTrigger>
          <TabsTrigger value="webinars"><Users className="mr-2 h-4 w-4" /> Webinars</TabsTrigger>
        </TabsList>

        {(['ebooks', 'videos', 'notes', 'webinars'] as ResourceTabKey[]).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <CardTitle>{getResourceTypeLabel(tabKey)}s</CardTitle>
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

