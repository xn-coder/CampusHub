
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course, CourseResource, CourseResourceType, UserRole } from '@/types';

// Helper to group resources
const groupResourcesByType = (resources: CourseResource[]): Required<Course>['resources'] => {
  const grouped: Required<Course>['resources'] = { ebooks: [], videos: [], notes: [], webinars: [] };
  const dbTypeToResourceKey: Record<CourseResourceType, keyof typeof grouped> = {
    ebook: 'ebooks',
    video: 'videos',
    note: 'notes',
    webinar: 'webinars',
  };
  resources.forEach(res => {
    const key = dbTypeToResourceKey[res.type as CourseResourceType];
    if (key) {
      grouped[key].push(res);
    }
  });
  return grouped;
};

export async function getCourseDetailsForViewingAction(courseId: string): Promise<{
  ok: boolean;
  course?: Course;
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
      .eq('course_id', courseId);

    if (resourcesError) {
      console.warn("Failed to load course resources, but returning course details:", resourcesError.message);
    }
    
    const groupedResources = groupResourcesByType(resourcesData || []);
    const enrichedCourse: Course = { ...(courseData as Course), resources: groupedResources };

    return { ok: true, course: enrichedCourse };
  } catch (error: any) {
    console.error("Error in getCourseDetailsForViewingAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function checkUserEnrollmentForCourseViewAction(
  courseId: string,
  userId: string, // This is users.id
  userRole: UserRole
): Promise<{ ok: boolean; isEnrolled: boolean; message?: string }> {
  if (!courseId || !userId || !userRole) {
    return { ok: false, isEnrolled: false, message: "Course ID, User ID, and User Role are required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    if (userRole === 'admin' || userRole === 'superadmin') {
      return { ok: true, isEnrolled: true }; // Admins can view all
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

    return { ok: true, isEnrolled: !!enrollment };

  } catch (error: any) {
    console.error("Error in checkUserEnrollmentForCourseViewAction:", error);
    return { ok: false, isEnrolled: false, message: error.message || "An unexpected error occurred during enrollment check." };
  }
}
