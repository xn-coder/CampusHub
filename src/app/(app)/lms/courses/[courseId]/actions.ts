
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course, LmsLesson, CourseResource, UserRole, LmsStudentLessonProgress } from '@/types';

interface EnrichedCourseForViewing extends Course {
  lessons: (LmsLesson & {
    resources: CourseResource[];
    is_completed?: boolean;
  })[];
}

export async function getCourseDetailsForViewingAction(courseId: string, studentId: string): Promise<{
  ok: boolean;
  course?: EnrichedCourseForViewing;
  message?: string;
  progress?: { completed: number; total: number; percentage: number };
}> {
  if (!courseId || !studentId) {
    return { ok: false, message: "Course ID and Student ID are required." };
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

    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lms_lessons')
      .select('*, resources:lms_course_resources(*)')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (lessonsError) {
      return { ok: false, message: `Failed to fetch lessons: ${lessonsError.message}` };
    }

    const lessonIds = (lessonsData || []).map(l => l.id);
    let completedLessonIds: string[] = [];

    if (lessonIds.length > 0) {
        const { data: progressData, error: progressError } = await supabase
            .from('lms_student_lesson_progress')
            .select('lesson_id')
            .eq('student_id', studentId)
            .in('lesson_id', lessonIds);
        
        if (progressError) {
            console.warn("Could not fetch student progress:", progressError.message);
        } else {
            completedLessonIds = (progressData || []).map(p => p.lesson_id);
        }
    }
    
    const enrichedLessons = (lessonsData || []).map(lesson => ({
        ...lesson,
        resources: (lesson.resources || []) as CourseResource[],
        is_completed: completedLessonIds.includes(lesson.id)
    }));
    
    const enrichedCourse: EnrichedCourseForViewing = {
        ...(courseData as Course),
        lessons: enrichedLessons,
    };
    
    const totalLessons = enrichedLessons.length;
    const completedLessons = completedLessonIds.length;
    const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    return { 
        ok: true, 
        course: enrichedCourse, 
        progress: { completed: completedLessons, total: totalLessons, percentage }
    };
  } catch (error: any) {
    console.error("Error in getCourseDetailsForViewingAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function checkUserEnrollmentForCourseViewAction(
  courseId: string,
  userId: string, // This is users.id
  userRole: UserRole
): Promise<{ ok: boolean; isEnrolled: boolean; studentProfileId?: string; message?: string }> {
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

    return { ok: true, isEnrolled: !!enrollment, studentProfileId: userRole === 'student' ? userProfileId : undefined };

  } catch (error: any) {
    console.error("Error in checkUserEnrollmentForCourseViewAction:", error);
    return { ok: false, isEnrolled: false, message: error.message || "An unexpected error occurred during enrollment check." };
  }
}

export async function markLessonAsCompleteAction(input: {
    student_id: string;
    lesson_id: string;
    course_id: string;
}): Promise<{ ok: boolean, message: string }> {
    const supabase = createSupabaseServerClient();
    const { student_id, lesson_id, course_id } = input;
    
    const { error } = await supabase.from('lms_student_lesson_progress').insert({
        student_id,
        lesson_id,
        course_id,
        completed_at: new Date().toISOString()
    });

    if (error) {
        if (error.code === '23505') { // Unique constraint violation
            return { ok: true, message: "Lesson already marked as complete." };
        }
        return { ok: false, message: error.message };
    }
    
    return { ok: true, message: "Lesson marked as complete!" };
}
