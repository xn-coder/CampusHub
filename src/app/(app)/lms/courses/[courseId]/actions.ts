
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
    // Superadmin has full access to all course content, not considered a student/teacher enrollment
    if (userRole === 'superadmin') {
      return { ok: true, isEnrolled: true }; 
    }
    
    // For admins, they are considered "enrolled" for full access IF they own the course OR it's assigned to their school.
    // They are NEVER considered enrolled if they are specifically previewing.
    if (userRole === 'admin') {
      if (preview) {
        return { ok: true, isEnrolled: false, message: "Admin is in preview mode." };
      }
      // Check if admin is from the school the course is assigned to.
      const { data: userSchool, error: userSchoolError } = await supabase.from('users').select('school_id').eq('id', userId).single();
      if (userSchoolError || !userSchool) return { ok: false, isEnrolled: false, message: "Could not verify admin's school." };
      
      const { data: course, error: courseError } = await supabase.from('lms_course_school_availability').select('school_id').eq('course_id', courseId).eq('school_id', userSchool.school_id).maybeSingle();
      if (courseError) return { ok: false, isEnrolled: false, message: "Error checking course assignment." };

      return { ok: true, isEnrolled: !!course };
    }

    // For other roles (student/teacher), they must be explicitly enrolled.
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

// New action to record completion
export async function markResourceAsCompleteAction(
  userId: string,
  courseId: string,
  resourceId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, school_id')
    .eq('user_id', userId)
    .single();

  if (studentError || !student) {
    return { ok: false, message: "Could not find student profile to save progress." };
  }
  
  const { error } = await supabase.from('lms_completion').upsert(
    {
      student_id: student.id,
      course_id: courseId,
      resource_id: resourceId,
      school_id: student.school_id,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,course_id,resource_id' }
  );
  
  if (error) {
    if (error.message.includes('relation "public.lms_completion" does not exist')) {
      console.warn("LMS Completion table does not exist. Progress cannot be saved.");
      // Return ok:true so the UI can still update visually, even if backend saving fails.
      // This prevents a disruptive error for the user for a non-critical feature if DB is not updated.
      return { ok: true, message: "Progress could not be saved to the database. The 'lms_completion' table is missing." };
    }
    console.error("Error saving resource completion:", error);
    return { ok: false, message: `Failed to save progress: ${error.message}` };
  }

  return { ok: true, message: "Progress saved." };
}

// New action to get completion status
export async function getCompletionStatusAction(
  userId: string,
  courseId: string
): Promise<{ ok: boolean; completedResources?: Record<string, boolean> }> {
  const supabase = createSupabaseServerClient();
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (studentError || !student) {
    return { ok: false, completedResources: {} };
  }

  const { data, error } = await supabase
    .from('lms_completion')
    .select('resource_id')
    .eq('student_id', student.id)
    .eq('course_id', courseId);
    
  if (error) {
    if (error.message.includes('relation "public.lms_completion" does not exist')) {
        console.warn("LMS Completion table does not exist. Cannot fetch completion status.");
        return { ok: true, completedResources: {} }; // Return empty object gracefully
    }
    console.error("Error fetching completion status:", error);
    return { ok: false, completedResources: {} };
  }

  const completedMap: Record<string, boolean> = {};
  (data || []).forEach(item => {
    completedMap[item.resource_id] = true;
  });

  return { ok: true, completedResources: completedMap };
}
