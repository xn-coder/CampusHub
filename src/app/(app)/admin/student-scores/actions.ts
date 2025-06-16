
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { StudentScore, Student, Exam, ClassData, Subject, Teacher } from '@/types';

async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolId: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export async function getStudentScoresPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  scores?: StudentScore[];
  students?: Student[];
  exams?: Exam[];
  classes?: ClassData[];
  subjects?: Subject[];
  teachers?: Teacher[]; // To show who recorded the score
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [scoresRes, studentsRes, examsRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
      supabaseAdmin.from('student_scores').select('*').eq('school_id', schoolId).order('date_recorded', { ascending: false }),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('exams').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('teachers').select('id, name').eq('school_id', schoolId) // Only fetch ID and name for teachers
    ]);

    if (scoresRes.error) throw new Error(`Fetching scores failed: ${scoresRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);

    return {
      ok: true,
      schoolId,
      scores: scoresRes.data || [],
      students: studentsRes.data || [],
      exams: examsRes.data || [],
      classes: classesRes.data || [],
      subjects: subjectsRes.data || [],
      teachers: teachersRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getStudentScoresPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}
    