"use server";

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course } from '@/types';

export interface LmsSchoolReportData extends Pick<Course, 'id' | 'title'> {
    studentEnrollmentCount: number;
    teacherEnrollmentCount: number;
}

export async function getLmsSchoolReportAction(adminUserId: string): Promise<{
    ok: boolean;
    reportData?: LmsSchoolReportData[];
    message?: string;
}> {
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

        const { data: assignedCourses, error: coursesError } = await supabase
            .from('lms_course_school_availability')
            .select('course:lms_courses(id, title)')
            .eq('school_id', schoolId);

        if (coursesError) throw new Error(`Failed to fetch assigned courses: ${coursesError.message}`);
        if (!assignedCourses || assignedCourses.length === 0) {
            return { ok: true, reportData: [] };
        }

        const courseIds = assignedCourses.map(ac => (ac.course as Course).id);

        const [studentEnrollmentsRes, teacherEnrollmentsRes] = await Promise.all([
            supabase
                .from('lms_student_course_enrollments')
                .select('course_id', { count: 'exact' })
                .eq('school_id', schoolId)
                .in('course_id', courseIds),
            supabase
                .from('lms_teacher_course_enrollments')
                .select('course_id', { count: 'exact' })
                .eq('school_id', schoolId)
                .in('course_id', courseIds)
        ]);
        
        if(studentEnrollmentsRes.error) throw new Error(`Failed to fetch student enrollments: ${studentEnrollmentsRes.error.message}`);
        if(teacherEnrollmentsRes.error) throw new Error(`Failed to fetch teacher enrollments: ${teacherEnrollmentsRes.error.message}`);

        const studentCounts = studentEnrollmentsRes.data.reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const teacherCounts = teacherEnrollmentsRes.data.reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const reportData: LmsSchoolReportData[] = assignedCourses.map(ac => {
            const course = ac.course as Course;
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
