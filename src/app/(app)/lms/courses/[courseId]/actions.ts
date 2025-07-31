

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course, CourseResource, UserRole } from '@/types';

export async function getCourseForViewingAction(courseId: string): Promise<{
  ok: boolean;
  course?: Course & { resources: CourseResource[] };
  message?: string;
}> {
  if (!courseId) {
    return { ok: false, message: "Course ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: courseData, error: courseError } = await supabase
      .from('lms_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !courseData) {
      return { ok: false, message: courseError?.message || "Course not found." };
    }

    const { data: resourcesData, error: resourcesError } = await supabase
        .from('lms_course_resources')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true });

    if (resourcesError) {
        return { ok: false, message: `Failed to fetch resources: ${resourcesError.message}` };
    }
    
    const enrichedCourse = {
        ...(courseData as Course),
        resources: (resourcesData || []) as CourseResource[],
    };

    return { ok: true, course: enrichedCourse };
  } catch (error: any) {
    console.error("Error in getCourseForViewingAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function checkUserEnrollmentForCourseViewAction(
  courseId: string,
  userId: string, // This is users.id
  userRole: UserRole,
  preview: boolean = false
): Promise<{ ok: boolean; isEnrolled: boolean; studentProfileId?: string; message?: string }> {
  if (!courseId || !userId || !userRole) {
    return { ok: false, isEnrolled: false, message: "Course ID, User ID, and User Role are required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    // Admins and superadmins always have access, enrolled or not.
    if (userRole === 'admin' || userRole === 'superadmin') {
      return { ok: true, isEnrolled: true }; 
    }
    
    // For other roles, if it's a preview, they are not considered "enrolled" for content access purposes.
    if (preview) { 
      return { ok: true, isEnrolled: false };
    }

    let userProfileId: string | null = null;
    if (userRole === 'student') {
      const { data: studentProfile, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();
      if (studentError || !studentProfile) {
        return { ok: false, isEnrolled: false, message: "Student profile not found."};
      }
      userProfileId = studentProfile.id;
    } else if (userRole === 'teacher') {
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userId)
        .single();
      if (teacherError || !teacherProfile) {
         return { ok: false, isEnrolled: false, message: "Teacher profile not found."};
      }
      userProfileId = teacherProfile.id;
    }

    if (!userProfileId) {
      return { ok: false, isEnrolled: false, message: "User profile ID could not be determined for enrollment check." };
    }
    
    const enrollmentTable = userRole === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
    const fkColumn = userRole === 'student' ? 'student_id' : 'teacher_id';

    const { data: enrollment, error: enrollmentError } = await supabase
      .from(enrollmentTable)
      .select('id')
      .eq('course_id', courseId)
      .eq(fkColumn, userProfileId)
      .maybeSingle();

    if (enrollmentError) {
      console.error(`Enrollment check error for ${userRole} ${userProfileId} in course ${courseId}:`, enrollmentError);
      return { ok: false, isEnrolled: false, message: `Database error checking enrollment: ${enrollmentError.message}` };
    }

    return { ok: true, isEnrolled: !!enrollment, studentProfileId: userRole === 'student' ? userProfileId : undefined };

  } catch (error: any) {
    console.error("Error in checkUserEnrollmentForCourseViewAction:", error);
    return { ok: false, isEnrolled: false, message: error.message || "An unexpected error occurred during enrollment check." };
  }
}
