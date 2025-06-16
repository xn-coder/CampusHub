
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';

export async function getIdCardPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  students?: Student[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!adminUserId) {
    return { ok: false, message: "Admin User ID is required." };
  }

  const supabase = createSupabaseServerClient();

  try {
    // Fetch admin's school ID
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('admin_user_id', adminUserId)
      .single();

    if (schoolError || !schoolData) {
      console.error("Error fetching admin's school for ID cards:", schoolError?.message);
      return { ok: false, message: "Admin not linked to a school or school not found." };
    }
    const schoolId = schoolData.id;

    // Fetch students for the school
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId);

    if (studentsError) {
      console.error("Error fetching students for ID cards:", studentsError);
      return { ok: false, message: `Failed to fetch students: ${studentsError.message}`, schoolId };
    }

    // Fetch classes for the school
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId);

    if (classesError) {
      console.error("Error fetching classes for ID cards:", classesError);
      return { ok: false, message: `Failed to fetch classes: ${classesError.message}`, schoolId, students: studentsData || [] };
    }

    return {
      ok: true,
      schoolId,
      students: studentsData || [],
      classes: classesData || [],
    };

  } catch (error: any) {
    console.error("Unexpected error in getIdCardPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
