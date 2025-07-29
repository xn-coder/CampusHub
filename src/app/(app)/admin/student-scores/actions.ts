
'use server';

console.log('[LOG] Loading src/app/(app)/admin/student-scores/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentScore, Student, Exam, ClassData, Subject, Teacher } from '@/types';
import { postAnnouncementAction } from '@/app/(app)/communication/actions';

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
  school?: {id: string, name: string, logo_url: string | null} | null;
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [scoresRes, studentsRes, examsRes, classesRes, subjectsRes, teachersRes, schoolRes] = await Promise.all([
      supabaseAdmin.from('student_scores').select('*').eq('school_id', schoolId).order('date_recorded', { ascending: false }),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('exams').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('teachers').select('id, name').eq('school_id', schoolId),
      supabaseAdmin.from('schools').select('id, name, logo_url').eq('id', schoolId).single()
    ]);

    if (scoresRes.error) throw new Error(`Fetching scores failed: ${scoresRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);
    if (schoolRes.error) throw new Error(`Fetching school details failed: ${schoolRes.error.message}`);

    return {
      ok: true,
      schoolId,
      scores: scoresRes.data || [],
      students: studentsRes.data || [],
      exams: examsRes.data || [],
      classes: classesRes.data || [],
      subjects: subjectsRes.data || [],
      teachers: teachersRes.data || [],
      school: schoolRes.data
    };
  } catch (error: any) {
    console.error("Error in getStudentScoresPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

export async function notifyStudentForReExamAction(
  studentId: string, 
  examName: string,
  classId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('name')
    .eq('id', studentId)
    .single();
    
  if (studentError || !student) {
    console.error('Error fetching student for re-exam notification:', studentError);
    return { ok: false, message: 'Could not find student to send notification.' };
  }
  
  const { data: adminUser } = await supabase.from('users').select('id, name').eq('school_id', schoolId).eq('role', 'admin').limit(1).single();
  
  if (!adminUser) {
    return {ok: false, message: "Could not find an admin user to post the announcement."};
  }

  const result = await postAnnouncementAction({
    title: `Re-exam Notification: ${examName}`,
    content: `Dear ${student.name},\n\nThis is to inform you that you are eligible for a re-exam for the subject/exam: ${examName}.\n\nPlease contact the school administration or your class teacher for further details regarding the schedule and registration process.`,
    author_name: 'School Administration',
    posted_by_user_id: adminUser.id,
    posted_by_role: 'admin',
    target_class_id: classId,
    school_id: schoolId
  });

  if (!result.ok) {
    return { ok: false, message: `Failed to post re-exam announcement. Reason: ${result.message}` };
  }

  return { ok: true, message: `Notification for re-exam sent to ${student.name}.` };
}

export async function deleteExamAction(examIds: string[], schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  const { error: scoresDeleteError } = await supabaseAdmin
    .from('student_scores')
    .delete()
    .in('exam_id', examIds)
    .eq('school_id', schoolId);
  
  if(scoresDeleteError){
     console.error("Error deleting scores for exam group:", scoresDeleteError);
    return { ok: false, message: `Failed to delete associated scores: ${scoresDeleteError.message}` };
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .in('id', examIds)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting exam group:", error);
    return { ok: false, message: `Failed to delete exam group: ${error.message}` };
  }
  
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam group and associated scores deleted successfully.' };
}
    

