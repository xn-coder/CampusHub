
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';
import { getAdminSchoolIdAction } from '../academic-years/actions';

export async function getStudentDataExportPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  schoolName?: string | null;
  students?: Student[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!adminUserId) {
    return { ok: false, message: "Admin User ID is required." };
  }

  const supabase = createSupabaseServerClient();

  try {
    const schoolId = await getAdminSchoolIdAction(adminUserId);
    if (!schoolId) {
        return { ok: false, message: "Admin not linked to a school or school not found." };
    }

    // Fetch school name, students, and classes in parallel
    const [schoolRes, studentsRes, classesRes] = await Promise.all([
        supabase.from('schools').select('name').eq('id', schoolId).single(),
        supabase.from('students').select('*').eq('school_id', schoolId),
        supabase.from('classes').select('*').eq('school_id', schoolId)
    ]);

    if (schoolRes.error) {
        console.error("Error fetching school name for data export:", schoolRes.error?.message);
        return { ok: false, message: `Could not fetch school details: ${schoolRes.error.message}` };
    }
    const schoolName = schoolRes.data.name;

    if (studentsRes.error) {
      console.error("Error fetching students for data export:", studentsRes.error);
      return { ok: false, message: `Failed to fetch students: ${studentsRes.error.message}`, schoolId, schoolName };
    }

    if (classesRes.error) {
      console.error("Error fetching classes for data export:", classesRes.error);
      return { ok: false, message: `Failed to fetch classes: ${classesRes.error.message}`, schoolId, schoolName, students: studentsRes.data || [] };
    }

    return {
      ok: true,
      schoolId,
      schoolName,
      students: studentsRes.data || [],
      classes: classesRes.data || [],
    };

  } catch (error: any) {
    console.error("Unexpected error in getStudentDataExportPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
