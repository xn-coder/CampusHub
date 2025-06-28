
'use server';

console.log('[LOG] Loading src/app/(app)/admin/student-scores/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { StudentScore, Student, Exam, ClassData, Subject, Teacher } from '@/types';
import { sendEmail } from '@/services/emailService';

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

export async function notifyStudentForReExamAction(
  studentId: string, 
  examName: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('email, name')
    .eq('id', studentId)
    .single();

  if (studentError || !student || !student.email) {
    console.error('Error fetching student for re-exam notification:', studentError);
    return { ok: false, message: 'Could not find student email to send notification.' };
  }

  const emailSubject = `Important: Re-exam for ${examName}`;
  const emailBody = `
    <h1>Re-exam Notification</h1>
    <p>Dear ${student.name},</p>
    <p>This is to inform you that you are eligible for a re-exam for the subject/exam: <strong>${examName}</strong>.</p>
    <p>Please contact the school administration or your class teacher for further details regarding the schedule and registration process for the re-exam.</p>
    <p>Best regards,<br/>CampusHub School Administration</p>
  `;

  try {
    const result = await sendEmail({
      to: student.email,
      subject: emailSubject,
      html: emailBody,
    });

    if (!result.ok) {
      console.error(`Failed to send re-exam notification email: ${result.message}`);
      return { ok: false, message: `Failed to dispatch notification email. Reason: ${result.message}` };
    }

    console.log(`Re-exam notification email successfully dispatched for student ${studentId}.`);
    return { ok: true, message: `Notification for re-exam sent to ${student.name}.` };
  } catch (apiError: any) {
    console.error(`Error calling email service for re-exam notification: ${apiError.message}`);
    return { ok: false, message: 'An error occurred while sending the notification.' };
  }
}
    
