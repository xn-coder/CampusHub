
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';

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
    // Fetch admin's school ID and Name
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id, name')
      .eq('admin_user_id', adminUserId)
      .single();

    if (schoolError || !schoolData) {
      console.error("Error fetching admin's school for data export:", schoolError?.message);
      return { ok: false, message: "Admin not linked to a school or school not found." };
    }
    const schoolId = schoolData.id;
    const schoolName = schoolData.name;

    // Fetch students for the school
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId);

    if (studentsError) {
      console.error("Error fetching students for data export:", studentsError);
      return { ok: false, message: `Failed to fetch students: ${studentsError.message}`, schoolId, schoolName };
    }

    // Fetch classes for the school
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId);

    if (classesError) {
      console.error("Error fetching classes for data export:", classesError);
      return { ok: false, message: `Failed to fetch classes: ${classesError.message}`, schoolId, schoolName, students: studentsData || [] };
    }

    return {
      ok: true,
      schoolId,
      schoolName,
      students: studentsData || [],
      classes: classesData || [],
    };

  } catch (error: any) {
    console.error("Unexpected error in getStudentDataExportPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
