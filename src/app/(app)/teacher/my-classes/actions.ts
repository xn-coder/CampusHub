
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { ClassData, Student } from '@/types';

interface EnrichedClassData extends ClassData {
  students: Student[];
}

export async function getTeacherClassesDataAction(teacherUserId: string): Promise<{
  ok: boolean;
  message?: string;
  classesWithStudents?: EnrichedClassData[];
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
      .select('*')
      .eq('teacher_id', teacherProfileId)
      .eq('school_id', schoolId);

    if (classesError) {
      throw new Error(`Failed to load classes: ${classesError.message}`);
    }

    if (!classesData || classesData.length === 0) {
      return { ok: true, classesWithStudents: [] };
    }

    const classIds = classesData.map(c => c.id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .in('class_id', classIds)
      .eq('school_id', schoolId);

    if (studentsError) {
      throw new Error(`Failed to load students for classes: ${studentsError.message}`);
    }

    const enrichedClasses = classesData.map(cls => {
      const studentsInClass = (studentsData || []).filter(student => student.class_id === cls.id);
      return {
        ...(cls as ClassData),
        students: studentsInClass as Student[],
      };
    });

    return { ok: true, classesWithStudents: enrichedClasses };
  } catch (error: any) {
    console.error("Error in getTeacherClassesDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
