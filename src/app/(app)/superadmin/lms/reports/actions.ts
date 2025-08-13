"use server";

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Course } from '@/types';

export interface LmsGlobalReportData extends Pick<Course, 'id' | 'title'> {
    schoolName: string | null;
    assignedSchoolCount: number;
    totalEnrollments: number;
}

export async function getLmsGlobalReportAction(): Promise<{
    ok: boolean;
    reportData?: LmsGlobalReportData[];
    message?: string;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: courses, error: coursesError } = await supabase
            .from('lms_courses')
            .select('*, school:school_id(name)')
            .order('created_at', { ascending: false });

        if (coursesError) throw new Error(`Failed to fetch courses: ${coursesError.message}`);
        if (!courses || courses.length === 0) return { ok: true, reportData: [] };

        const courseIds = courses.map(c => c.id);

        const [schoolAssignmentsRes, studentEnrollmentsRes, teacherEnrollmentsRes] = await Promise.all([
            supabase.from('lms_course_school_availability').select('course_id'),
            supabase.from('lms_student_course_enrollments').select('course_id'),
            supabase.from('lms_teacher_course_enrollments').select('course_id')
        ]);
        
        if(schoolAssignmentsRes.error) throw new Error(`Failed to fetch school assignments: ${schoolAssignmentsRes.error.message}`);
        if(studentEnrollmentsRes.error) throw new Error(`Failed to fetch student enrollments: ${studentEnrollmentsRes.error.message}`);
        if(teacherEnrollmentsRes.error) throw new Error(`Failed to fetch teacher enrollments: ${teacherEnrollmentsRes.error.message}`);

        const schoolAssignmentCounts = schoolAssignmentsRes.data.reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const studentEnrollmentCounts = studentEnrollmentsRes.data.reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const teacherEnrollmentCounts = teacherEnrollmentsRes.data.reduce((acc, item) => {
            acc[item.course_id] = (acc[item.course_id] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const reportData: LmsGlobalReportData[] = courses.map(course => {
            const courseId = course.id;
            const totalEnrollments = (studentEnrollmentCounts[courseId] || 0) + (teacherEnrollmentCounts[courseId] || 0);
            return {
                id: courseId,
                title: course.title,
                schoolName: (course.school as any)?.name || null,
                assignedSchoolCount: schoolAssignmentCounts[courseId] || 0,
                totalEnrollments: totalEnrollments,
            };
        });

        return { ok: true, reportData };

    } catch (e: any) {
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}
