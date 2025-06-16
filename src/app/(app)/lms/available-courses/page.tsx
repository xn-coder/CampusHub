
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
import { enrollUserInCourseAction } from '../../admin/lms/courses/actions'; // Re-use admin action for enrollment


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
      if (typeof window !== 'undefined') {
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        const userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId && role) {
          // Fetch user's profile (student or teacher) to get their specific profile ID and school ID
          const profileTable = role === 'student' ? 'students' : 'teachers';
          const { data: userProfile, error: profileError } = await supabase
            .from(profileTable)
            .select('id, school_id')
            .eq('user_id', userId)
            .single();

          if (profileError || !userProfile) {
            toast({ title: "Error", description: "Could not load user profile. Enrollment status might be inaccurate.", variant: "destructive"});
            setCurrentUserProfileId(null);
            setCurrentSchoolId(null);
          } else {
            setCurrentUserProfileId(userProfile.id);
            setCurrentSchoolId(userProfile.school_id);
          }
        }
        
        // Fetch all courses (global or for the user's school if applicable)
        // This logic can be refined based on how courses are scoped (global vs school-specific)
        // For now, fetching all and filtering client-side, or server-side if `currentSchoolId` is known
        let courseQuery = supabase.from('lms_courses').select('*');
        // if (currentSchoolId) {
        //   courseQuery = courseQuery.or(`school_id.eq.${currentSchoolId},school_id.is.null`); // Courses for this school or global
        // } else {
        //    courseQuery = courseQuery.is('school_id', null); // Only global courses if no school context
        // }
        
        const { data: coursesData, error: coursesError } = await courseQuery.order('created_at', { ascending: false });

        if (coursesError) {
          toast({ title: "Error", description: "Failed to fetch courses.", variant: "destructive" });
          setCourses([]);
        } else {
          setCourses(coursesData || []);
          if (currentUserProfileId && role && (coursesData && coursesData.length > 0)) {
            await fetchEnrollmentStatuses(coursesData.map(c => c.id), currentUserProfileId, role, currentSchoolId);
          }
        }
      }
      setIsLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfileId, currentUserRole, currentSchoolId]); // Re-fetch if profile changes


  async function fetchEnrollmentStatuses(courseIds: string[], userProfileId: string, role: UserRole, schoolId: string | null) {
    if (!schoolId) { // Cannot check school-specific enrollments without schoolId
        // If courses can be global and enrollments too, this needs adjustment
        console.warn("School ID missing, cannot accurately fetch enrollment statuses for school-specific enrollments.");
        const initialStatus: Record<string, boolean> = {};
        courseIds.forEach(id => initialStatus[id] = false); // Default to not enrolled
        setEnrollmentStatus(initialStatus);
        return;
    }

    const enrollmentTable = role === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
    const userIdColumn = role === 'student' ? 'student_id' : 'teacher_id';

    const { data: enrollments, error } = await supabase
      .from(enrollmentTable)
      .select('course_id')
      .eq(userIdColumn, userProfileId)
      .in('course_id', courseIds)
      .eq('school_id', schoolId); // Enrollments are school-specific

    if (error) {
      toast({ title: "Error", description: "Failed to fetch enrollment status.", variant: "destructive" });
      return;
    }

    const statusMap: Record<string, boolean> = {};
    courseIds.forEach(id => statusMap[id] = false); // Default to not enrolled
    (enrollments || []).forEach(en => {
      statusMap[en.course_id] = true;
    });
    setEnrollmentStatus(statusMap);
  }

  const handleEnrollUnpaid = async (courseId: string) => {
    if (!currentUserProfileId || !currentUserRole || !currentSchoolId) {
      toast({ title: "Error", description: "User profile or school not identified. Please log in or ensure your profile is complete.", variant: "destructive"});
      return;
    }
    
    setIsEnrolling(prev => ({ ...prev, [courseId]: true }));
    const result = await enrollUserInCourseAction({
      course_id: courseId,
      user_profile_id: currentUserProfileId,
      user_type: currentUserRole,
      school_id: currentSchoolId, // Enrollments are school-specific
    });
    setIsEnrolling(prev => ({ ...prev, [courseId]: false }));

    if (result.ok) {
      toast({ title: "Enrolled Successfully!", description: "You have been enrolled in the course."});
      setEnrollmentStatus(prev => ({ ...prev, [courseId]: true })); // Update UI immediately
    } else {
      toast({ title: "Enrollment Failed", description: result.message, variant: "destructive"});
    }
  };

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
              </CardHeader>
              <CardContent className="flex-grow">
                {course.is_paid && course.price && (
                  <p className="text-lg font-semibold text-foreground mb-2">${course.price.toFixed(2)}</p>
                )}
                {/* Add enrollment count if available/needed */}
              </CardContent>
              <CardFooter>
                {enrollmentStatus[course.id] ? (
                   <Button asChild className="w-full" variant="secondary">
                     <Link href={`/lms/courses/${course.id}`}>
                       <Eye className="mr-2 h-4 w-4"/> View Course
                     </Link>
                   </Button>
                ) : course.is_paid ? (
                  <Button asChild className="w-full">
                    <Link href={`/student/lms/activate?courseId=${course.id}`}>
                       <ShoppingCart className="mr-2 h-4 w-4"/> Activate Course
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={() => handleEnrollUnpaid(course.id)} className="w-full" disabled={isEnrolling[course.id] || !currentUserProfileId || !currentSchoolId}>
                    {isEnrolling[course.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4"/>} 
                    {isEnrolling[course.id] ? 'Enrolling...' : 'Enroll Now (Free)'}
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
