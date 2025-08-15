
"use server";

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course } from '@/types';

export interface LmsSchoolReportData extends Pick<Course, 'id' | 'title'> {
    studentEnrollmentCount: number;
    teacherEnrollmentCount: number;
}

interface GetLmsSchoolReportInput {
    adminUserId: string;
    startDate?: string;
    endDate?: string;
}

export async function getLmsSchoolReportAction(input: GetLmsSchoolReportInput): Promise<{
    ok: boolean;
    reportData?: LmsSchoolReportData[];
    message?: string;
}> {
    const { adminUserId, startDate, endDate } = input;
    if (!adminUserId) {
        return { ok: false, message: "Admin user ID is required." };
    }
    const supabase = createSupabaseServerClient();

    try {
        const { data: user, error: userError } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
        if (userError || !user?.school_id) {
            return { ok: false, message: "Admin is not linked to a school." };
        }
        const schoolId = user.school_id;

        // Fetch courses assigned to the school first
        const { data: assignedCourseLinks, error: coursesError } = await supabase
            .from('lms_course_school_availability')
            .select('course_id')
            .eq('school_id', schoolId);

        if (coursesError) throw new Error(`Failed to fetch assigned courses: ${coursesError.message}`);
        if (!assignedCourseLinks || assignedCourseLinks.length === 0) {
            return { ok: true, reportData: [] };
        }
        const assignedCourseIds = assignedCourseLinks.map(link => link.course_id);

        // Now fetch details for those courses, applying date filters
        let courseQuery = supabase
            .from('lms_courses')
            .select('id, title')
            .in('id', assignedCourseIds);

        if (startDate) {
            courseQuery = courseQuery.gte('created_at', startDate);
        }
        if (endDate) {
            courseQuery = courseQuery.lte('created_at', endDate);
        }

        const { data: courses, error: courseDetailsError } = await courseQuery;
        if (courseDetailsError) throw new Error(`Failed to fetch course details: ${courseDetailsError.message}`);
        if (!courses || courses.length === 0) {
            return { ok: true, reportData: [] };
        }

        const courseIds = courses.map(c => c.id);

        const [studentEnrollmentsRes, teacherEnrollmentsRes] = await Promise.all([
            supabase
                .from('lms_student_course_enrollments')
                .select('course_id', { count: 'exact' })
                .in('course_id', courseIds)
                .eq('school_id', schoolId),
            supabase
                .from('lms_teacher_course_enrollments')
                .select('course_id', { count: 'exact' })
                .in('course_id', courseIds)
                .eq('school_id', schoolId)
        ]);
        
        if(studentEnrollmentsRes.error) throw new Error(`Failed to fetch student enrollments: ${studentEnrollmentsRes.error.message}`);
        if(teacherEnrollmentsRes.error) throw new Error(`Failed to fetch teacher enrollments: ${teacherEnrollmentsRes.error.message}`);

        const studentCounts = (studentEnrollmentsRes.data || []).reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const teacherCounts = (teacherEnrollmentsRes.data || []).reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const reportData: LmsSchoolReportData[] = courses.map(course => {
            return {
                id: course.id,
                title: course.title,
                studentEnrollmentCount: studentCounts[course.id] || 0,
                teacherEnrollmentCount: teacherCounts[course.id] || 0,
            };
        });

        return { ok: true, reportData };

    } catch (e: any) {
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}
