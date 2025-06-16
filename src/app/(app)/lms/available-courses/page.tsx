
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Course, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Library, Lock, Unlock, Eye, ShoppingCart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { enrollUserInCourseAction } from '../../admin/lms/courses/actions';


export default function AvailableLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // User's primary UUID from 'users' table
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); // Student or Teacher profile ID
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<Record<string, boolean>>({}); // courseId: isEnrolled
  const [isEnrolling, setIsEnrolling] = useState<Record<string, boolean>>({}); // courseId: isEnrolling

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      let userProfileId: string | null = null;
      let userSchoolId: string | null = null;
      let userRole: UserRole | null = null;

      if (typeof window !== 'undefined') {
        userRole = localStorage.getItem('currentUserRole') as UserRole | null;
        const uId = localStorage.getItem('currentUserId');
        setCurrentUserRole(userRole);
        setCurrentUserId(uId);

        if (uId && userRole) {
          const profileTable = userRole === 'student' ? 'students' : userRole === 'teacher' ? 'teachers' : null;
          if (profileTable) {
            const { data: profile, error: profileError } = await supabase
              .from(profileTable)
              .select('id, school_id')
              .eq('user_id', uId)
              .single();

            if (profileError || !profile) {
              toast({ title: "Error", description: "Could not load user profile for enrollment checks.", variant: "destructive"});
            } else {
              userProfileId = profile.id;
              userSchoolId = profile.school_id;
              setCurrentUserProfileId(profile.id);
              setCurrentSchoolId(profile.school_id);
            }
          } else if (userRole === 'admin' || userRole === 'superadmin') {
             const { data: userRec, error: userErr } = await supabase
              .from('users').select('school_id').eq('id', uId).single();
            if (userRec) userSchoolId = userRec.school_id;
            setCurrentSchoolId(userSchoolId); 
          }
        }
      }
        
      let courseQuery = supabase.from('lms_courses').select('*');
      if (userSchoolId) {
        courseQuery = courseQuery.or(`school_id.eq.${userSchoolId},school_id.is.null`);
      } else if (userRole !== 'superadmin') { 
        courseQuery = courseQuery.is('school_id', null);
      }

      const { data: coursesData, error: coursesError } = await courseQuery.order('created_at', { ascending: false });

      if (coursesError) {
        toast({ title: "Error", description: "Failed to fetch courses.", variant: "destructive" });
        setCourses([]);
      } else {
        setCourses(coursesData || []);
        if (userProfileId && userRole && (coursesData && coursesData.length > 0)) {
           // Student or Teacher, fetch their specific enrollments
          await fetchEnrollmentStatuses(coursesData.map(c => c.id), userProfileId, userRole, userSchoolId);
        }
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);


  async function fetchEnrollmentStatuses(courseIds: string[], userProfileId: string, role: UserRole, schoolId: string | null) {
    const enrollmentTable = role === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
    const userIdColumn = role === 'student' ? 'student_profile_id' : 'teacher_id'; // Changed to student_profile_id

    let query = supabase
      .from(enrollmentTable)
      .select('course_id') // Select only course_id, removed student_id as it's redundant here
      .eq(userIdColumn, userProfileId)
      .in('course_id', courseIds);

    if (role === 'student' && schoolId) {
        query = query.eq('school_id', schoolId); 
    }
    

    const { data: enrollments, error } = await query;

    if (error) {
      toast({ title: "Error", description: "Failed to fetch enrollment status.", variant: "destructive" });
      return;
    }

    const statusMap: Record<string, boolean> = {};
    courseIds.forEach(id => statusMap[id] = false);
    (enrollments || []).forEach(en => {
      statusMap[en.course_id] = true;
    });
    setEnrollmentStatus(statusMap);
  }

  const handleEnrollUnpaid = async (courseId: string) => {
    if (!currentUserProfileId || !currentUserRole || !currentSchoolId) {
      toast({ title: "Error", description: "User profile or school not identified. Cannot enroll.", variant: "destructive"});
      return;
    }
    
    setIsEnrolling(prev => ({ ...prev, [courseId]: true }));
    const result = await enrollUserInCourseAction({
      course_id: courseId,
      user_profile_id: currentUserProfileId,
      user_type: currentUserRole,
      school_id: currentSchoolId, // Pass the user's school_id
    });
    setIsEnrolling(prev => ({ ...prev, [courseId]: false }));

    if (result.ok) {
      toast({ title: "Enrolled Successfully!", description: "You have been enrolled in the course."});
      setEnrollmentStatus(prev => ({ ...prev, [courseId]: true }));
    } else {
      toast({ title: "Enrollment Failed", description: result.message, variant: "destructive"});
    }
  };

  const canEnroll = currentUserRole === 'student' || currentUserRole === 'teacher';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Available LMS Courses" 
        description="Browse and enroll in courses offered by the institution." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading courses...</CardContent></Card>
      ) : courses.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No LMS courses available at this time.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center"><Library className="mr-2 h-5 w-5 text-primary" />{course.title}</CardTitle>
                    {course.is_paid ? (
                        <span className="text-xs font-semibold bg-destructive/20 text-destructive px-2 py-1 rounded-full flex items-center">
                            <Lock className="mr-1 h-3 w-3"/> Paid
                        </span>
                    ) : (
                         <span className="text-xs font-semibold bg-green-500/20 text-green-700 px-2 py-1 rounded-full flex items-center">
                            <Unlock className="mr-1 h-3 w-3"/> Unpaid
                        </span>
                    )}
                </div>
                <CardDescription className="line-clamp-3">{course.description || "No description available."}</CardDescription>
                 {course.school_id ? null : <Badge variant="outline" className="mt-1 w-fit">Global Course</Badge>}
              </CardHeader>
              <CardContent className="flex-grow">
                {course.is_paid && course.price && (
                  <p className="text-lg font-semibold text-foreground mb-2">${course.price.toFixed(2)}</p>
                )}
              </CardContent>
              <CardFooter>
                {canEnroll && enrollmentStatus[course.id] ? (
                   <Button asChild className="w-full" variant="secondary">
                     <Link href={`/lms/courses/${course.id}`}>
                       <Eye className="mr-2 h-4 w-4"/> View Course
                     </Link>
                   </Button>
                ) : canEnroll && course.is_paid ? (
                  <Button asChild className="w-full">
                    <Link href={`/student/lms/activate?courseId=${course.id}`}> {/* Assuming activation is primarily for students */}
                       <ShoppingCart className="mr-2 h-4 w-4"/> Activate Course
                    </Link>
                  </Button>
                ) : canEnroll && !course.is_paid ? (
                  <Button onClick={() => handleEnrollUnpaid(course.id)} className="w-full" disabled={isEnrolling[course.id] || !currentUserProfileId || !currentSchoolId}>
                    {isEnrolling[course.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4"/>} 
                    {isEnrolling[course.id] ? 'Enrolling...' : 'Enroll Now (Free)'}
                  </Button>
                ) : ( 
                   <Button asChild className="w-full" variant="outline">
                     <Link href={`/admin/lms/courses/${course.id}/content`}> 
                       <Eye className="mr-2 h-4 w-4"/> View Details
                     </Link>
                   </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


