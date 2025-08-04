
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';

// This action reuses the logic from my-classes/actions.ts to get all necessary data
// in a single, secure server call.
export async function getTeacherStudentsAndClassesAction(teacherUserId: string): Promise<{
  ok: boolean;
  message?: string;
  students?: Student[];
  classes?: ClassData[];
}> {
  if (!teacherUserId) {
    return { ok: false, message: "Teacher user ID is required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    const { data: teacherProfile, error: teacherError } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('user_id', teacherUserId)
      .single();

    if (teacherError || !teacherProfile) {
      return { ok: false, message: teacherError?.message || "Teacher profile not found." };
    }

    const { id: teacherProfileId, school_id: schoolId } = teacherProfile;

    if (!schoolId) {
      return { ok: false, message: "Teacher is not associated with a school." };
    }

    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name, division')
      .eq('teacher_id', teacherProfileId)
      .eq('school_id', schoolId);

    if (classesError) {
      throw new Error(`Failed to load classes: ${classesError.message}`);
    }

    const assignedClasses = classesData || [];
    if (assignedClasses.length === 0) {
      return { ok: true, students: [], classes: [] };
    }

    const classIds = assignedClasses.map(c => c.id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .order('name');

    if (studentsError) {
      throw new Error(`Failed to load students for classes: ${studentsError.message}`);
    }

    return {
      ok: true,
      students: (studentsData || []) as Student[],
      classes: assignedClasses as ClassData[],
    };
  } catch (error: any) {
    console.error("Error in getTeacherStudentsAndClassesAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
