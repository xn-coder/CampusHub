
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';

export async function getTeacherStudentsAndClassesAction(teacherId: string, schoolId: string): Promise<{
  ok: boolean;
  students?: Student[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!teacherId || !schoolId) {
    return { ok: false, message: "Teacher ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    // Fetch classes assigned to this teacher
    const { data: teacherClassesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name, division') // Only fetch what's needed for display
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId);

    if (classesError) throw new Error(`Fetching teacher's classes failed: ${classesError.message}`);
    
    const assignedClasses = teacherClassesData || [];
    if (assignedClasses.length === 0) {
      return { ok: true, students: [], classes: [] }; // Teacher has no classes
    }
    const assignedClassIds = assignedClasses.map(c => c.id);

    // Fetch students in those classes
    // Select all necessary student fields for the report. Removed mock activity fields.
    const { data: studentsInClasses, error: studentsError } = await supabase
      .from('students')
      .select('id, name, email, class_id, profile_picture_url, date_of_birth, contact_number, guardian_name, address, admission_date, user_id, school_id')
      .in('class_id', assignedClassIds)
      .eq('school_id', schoolId)
      .order('name');
    
    if (studentsError) throw new Error(`Fetching students for classes failed: ${studentsError.message}`);

    return {
      ok: true,
      students: (studentsInClasses || []) as Student[],
      classes: assignedClasses,
    };
  } catch (e: any) {
    console.error("Error in getTeacherStudentsAndClassesAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}
