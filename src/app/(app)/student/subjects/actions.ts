
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Subject, AcademicYear } from '@/types';

export async function getStudentSubjectsAction(userId: string): Promise<{
    ok: boolean;
    subjects?: (Subject & { academicYearName?: string })[];
    schoolId?: string | null;
    message?: string;
}> {
    if (!userId) {
        return { ok: false, message: "User not identified." };
    }

    const supabase = createSupabaseServerClient();

    try {
        const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('school_id, class_id')
            .eq('user_id', userId)
            .single();

        if (studentError || !studentData || !studentData.school_id) {
            return {
                ok: false,
                message: "Could not fetch student's school information. Your profile may be incomplete.",
                schoolId: null,
            };
        }
        
        const schoolId = studentData.school_id;

        const [subjectsResult, academicYearsResult] = await Promise.all([
            supabase.from('subjects').select('*').eq('school_id', schoolId).order('name'),
            supabase.from('academic_years').select('id, name').eq('school_id', schoolId)
        ]);

        if (subjectsResult.error) {
            throw new Error(`Failed to fetch subjects: ${subjectsResult.error.message}`);
        }
        
        const allSubjects: Subject[] = subjectsResult.data || [];
        const academicYears: Pick<AcademicYear, 'id' | 'name'>[] = academicYearsResult.data || [];
        
        const enrichedSubjects = allSubjects.map(sub => ({
            ...sub,
            academicYearName: sub.academic_year_id 
                ? academicYears.find(ay => ay.id === sub.academic_year_id)?.name 
                : 'General'
        }));

        return {
            ok: true,
            subjects: enrichedSubjects,
            schoolId: schoolId,
        };
    } catch (error: any) {
        console.error("Error in getStudentSubjectsAction:", error);
        return { ok: false, message: `An unexpected error occurred: ${error.message}` };
    }
}
