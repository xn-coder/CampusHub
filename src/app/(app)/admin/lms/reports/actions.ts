
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course, CourseResource } from '@/types';

export interface LmsSchoolReportData extends Pick<Course, 'id' | 'title'> {
  studentEnrollmentCount: number;
  teacherEnrollmentCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
}

interface GetLmsSchoolReportInput {
  adminUserId: string;
  startDate?: string;
  endDate?: string;
}

export async function getLmsSchoolReportAction(
  input: GetLmsSchoolReportInput
): Promise<{
  ok: boolean;
  reportData?: LmsSchoolReportData[];
  message?: string;
}> {
  const { adminUserId, startDate, endDate } = input;
  if (!adminUserId) {
    return { ok: false, message: 'Admin user ID is required.' };
  }
  const supabase = createSupabaseServerClient();

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', adminUserId)
      .single();
    if (userError || !user?.school_id) {
      return { ok: false, message: "Admin is not linked to a school." };
    }
    const schoolId = user.school_id;

    // Fetch courses assigned to the school
    const { data: assignedCourseLinks, error: coursesError } = await supabase
      .from('lms_course_school_availability')
      .select('course_id')
      .eq('school_id', schoolId);
    if (coursesError)
      throw new Error(`Failed to fetch assigned courses: ${coursesError.message}`);
    if (!assignedCourseLinks || assignedCourseLinks.length === 0) {
      return { ok: true, reportData: [] };
    }
    const assignedCourseIds = assignedCourseLinks.map((link) => link.course_id);

    // Fetch course details with optional date filters
    let courseQuery = supabase
      .from('lms_courses')
      .select('id, title')
      .in('id', assignedCourseIds);
    if (startDate) courseQuery = courseQuery.gte('created_at', startDate);
    if (endDate) courseQuery = courseQuery.lte('created_at', endDate);
    const { data: courses, error: courseDetailsError } = await courseQuery;
    if (courseDetailsError)
      throw new Error(`Failed to fetch course details: ${courseDetailsError.message}`);
    if (!courses || courses.length === 0) return { ok: true, reportData: [] };

    const courseIds = courses.map((c) => c.id);

    // Fetch all resources and enrollments in parallel
    const [
      resourcesRes,
      studentEnrollmentsRes,
      teacherEnrollmentsRes,
      completionsRes,
    ] = await Promise.all([
      supabase.from('lms_course_resources').select('id, course_id, url_or_content, type').in('course_id', courseIds),
      supabase.from('lms_student_course_enrollments').select('course_id, student_id').in('course_id', courseIds).eq('school_id', schoolId),
      supabase.from('lms_teacher_course_enrollments').select('course_id', { count: 'exact' }).in('course_id', courseIds).eq('school_id', schoolId),
      supabase.from('lms_completion').select('student_id, course_id, resource_id').in('course_id', courseIds),
    ]);

    if (resourcesRes.error) throw new Error(`Failed to fetch resources: ${resourcesRes.error.message}`);
    if (studentEnrollmentsRes.error) throw new Error(`Failed to fetch student enrollments: ${studentEnrollmentsRes.error.message}`);
    if (teacherEnrollmentsRes.error) throw new Error(`Failed to fetch teacher enrollments: ${teacherEnrollmentsRes.error.message}`);
    if (completionsRes.error) throw new Error(`Failed to fetch completions: ${completionsRes.error.message}`);

    const allResources = resourcesRes.data || [];
    const studentEnrollments = studentEnrollmentsRes.data || [];
    const completions = completionsRes.data || [];

    const teacherEnrollmentCounts = (teacherEnrollmentsRes.data || []).reduce(
      (acc, item) => {
        acc[item.course_id] = (acc[item.course_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Pre-calculate total resources for each course
    const resourceCounts = allResources.reduce((acc, resource) => {
        if (resource.type === 'note') { // It's a lesson
            try {
                const lessonContents = JSON.parse(resource.url_or_content || '[]');
                acc[resource.course_id] = (acc[resource.course_id] || 0) + lessonContents.length;
            } catch { /* ignore malformed JSON */ }
        }
        return acc;
    }, {} as Record<string, number>);

    const reportData = courses.map((course) => {
      const courseId = course.id;
      const enrolledStudents = studentEnrollments.filter(
        (e) => e.course_id === courseId
      );
      const totalResources = resourceCounts[courseId] || 0;

      let completedCount = 0;
      let inProgressCount = 0;
      let notStartedCount = 0;

      enrolledStudents.forEach((enrollment) => {
        const studentCompletions = completions.filter(
          (c) => c.student_id === enrollment.student_id && c.course_id === courseId
        ).length;

        if (studentCompletions === 0) {
          notStartedCount++;
        } else if (totalResources > 0 && studentCompletions >= totalResources) {
          completedCount++;
        } else {
          inProgressCount++;
        }
      });
      
      // Handle cases where a student is enrolled but hasn't completed anything, yet there are no resources. They are 'complete'.
      if (totalResources === 0) {
          completedCount += notStartedCount;
          notStartedCount = 0;
      }

      return {
        id: courseId,
        title: course.title,
        studentEnrollmentCount: enrolledStudents.length,
        teacherEnrollmentCount: teacherEnrollmentCounts[courseId] || 0,
        completedCount,
        inProgressCount,
        notStartedCount,
      };
    });

    return { ok: true, reportData };
  } catch (e: any) {
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}
