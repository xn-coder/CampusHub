
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Assignment, Student, Teacher, Subject } from '@/types';

interface EnrichedAssignment extends Assignment {
  teacherName?: string;
  subjectName?: string;
}

export async function getStudentAssignmentsAction(userId: string): Promise<{ 
  ok: boolean; 
  assignments?: EnrichedAssignment[]; 
  message?: string;
  studentClassId?: string | null;
  studentSchoolId?: string | null;
}> {
  if (!userId) {
    return { ok: false, message: "User not identified." };
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('class_id, school_id')
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData) {
      return { 
        ok: false, 
        message: studentError?.message || "Student profile not found.",
        studentClassId: null,
        studentSchoolId: null,
      };
    }
    
    const { class_id: studentClassId, school_id: studentSchoolId } = studentData;

    if (!studentSchoolId || !studentClassId) {
      return { 
        ok: true, // It's not an error, just no class/school
        assignments: [], 
        message: "Student not assigned to a class or school.",
        studentClassId,
        studentSchoolId,
      };
    }
    
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_id', studentClassId)
      .eq('school_id', studentSchoolId);

    if (assignmentsError) {
      return { 
        ok: false, 
        message: `Failed to fetch assignments: ${assignmentsError.message}`,
        studentClassId,
        studentSchoolId,
      };
    }

    if (!assignmentsData || assignmentsData.length === 0) {
      return { 
        ok: true, 
        assignments: [],
        studentClassId,
        studentSchoolId,
      };
    }

    const teacherIds = [...new Set(assignmentsData.map(a => a.teacher_id).filter(Boolean))];
    const subjectIds = [...new Set(assignmentsData.map(a => a.subject_id).filter(Boolean))];
    
    let teachers: Teacher[] = [];
    if (teacherIds.length > 0) {
        const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name')
        .in('id', teacherIds);
        if (teachersError) console.error("Error fetching teachers for assignments:", teachersError);
        else teachers = teachersData || [];
    }
    
    let subjects: Subject[] = [];
    if (subjectIds.length > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
        if (subjectsError) console.error("Error fetching subjects for assignments:", subjectsError);
        else subjects = subjectsData || [];
    }

    const enrichedAssignments: EnrichedAssignment[] = assignmentsData.map(asm => ({
      ...asm,
      teacherName: teachers.find(t => t.id === asm.teacher_id)?.name || 'N/A',
      subjectName: asm.subject_id ? subjects.find(s => s.id === asm.subject_id)?.name : undefined,
    }));

    return { 
      ok: true, 
      assignments: enrichedAssignments,
      studentClassId,
      studentSchoolId,
    };

  } catch (error: any) {
    return { 
      ok: false, 
      message: `An unexpected error occurred: ${error.message}`,
      studentClassId: null,
      studentSchoolId: null,
    };
  }
}
    