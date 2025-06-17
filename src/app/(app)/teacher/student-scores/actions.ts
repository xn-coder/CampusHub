
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import emailjs from 'emailjs-com';
import type { ClassData, Exam, Student, Subject } from '@/types';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  // console.log("EmailJS service configured in teacher/student-scores/actions.ts.");
} else {
  console.warn(
    "EmailJS is not fully configured in teacher/student-scores/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`--- MOCK EMAIL SEND REQUEST (${options.subject}) ---`);
    console.log("To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log("Subject:", options.subject);
    console.log("HTML Body:", options.html);
    console.log("--- END MOCK EMAIL (from /src/app/(app)/teacher/student-scores/actions.ts) ---");
    return { success: true, message: "Email sending is mocked as EmailJS is not configured. Check .env variables for EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY." };
  }

  const sendToAddresses = Array.isArray(options.to) ? options.to : [options.to];
  let allSuccessful = true;
  const detailedMessages: string[] = [];

  for (const recipientEmail of sendToAddresses) {
    const templateParams = {
      to_email: recipientEmail,
      subject_line: options.subject,
      html_body: options.html,
      from_name: 'CampusHub Notifications',
      reply_to: recipientEmail,
    };

    try {
      const response = await emailjs.send(SERVICE_ID!, TEMPLATE_ID!, templateParams, USER_ID!);
      detailedMessages.push(`Email successfully sent to ${recipientEmail}.`);
    } catch (error: any) {
      console.error(`Failed to send email to ${recipientEmail} via EmailJS from teacher/student-scores/actions.ts. Status: ${error?.status}, Text: ${error?.text}. Full error:`, error);
      detailedMessages.push(`Failed for ${recipientEmail}: ${error?.text || error?.message || 'Unknown EmailJS error'}`);
      allSuccessful = false;
    }
  }
  
  const overallMessage = allSuccessful 
    ? `Successfully sent ${sendToAddresses.length} email(s).` 
    : `Email sending attempted. Results: ${detailedMessages.join('; ')}`;

  return { success: allSuccessful, message: overallMessage };
}


interface SaveScoreInput {
  student_id: string;
  exam_id: string;
  subject_id: string; 
  class_id: string;
  score: string | number;
  max_marks?: number | null;
  recorded_by_teacher_id: string; 
  school_id: string;
}

export async function getTeacherStudentScoresPageInitialDataAction(teacherUserId: string): Promise<{
  ok: boolean;
  message?: string;
  teacherProfileId?: string;
  schoolId?: string;
  assignedClasses?: ClassData[];
  allExams?: Exam[];
  allSubjects?: Subject[];
}> {
  if (!teacherUserId) {
    return { ok: false, message: "Teacher user ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: teacherProfile, error: profileError } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('user_id', teacherUserId)
      .single();

    if (profileError || !teacherProfile) {
      return { ok: false, message: profileError?.message || "Teacher profile not found." };
    }
    const { id: teacherProfileId, school_id: schoolId } = teacherProfile;

    if (!schoolId) {
      return { ok: false, message: "Teacher is not associated with a school." };
    }

    const [classesRes, examsRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', teacherProfileId).eq('school_id', schoolId),
      supabase.from('exams').select('*').eq('school_id', schoolId),
      supabase.from('subjects').select('*').eq('school_id', schoolId),
    ]);

    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    
    return {
      ok: true,
      teacherProfileId,
      schoolId,
      assignedClasses: (classesRes.data || []) as ClassData[],
      allExams: (examsRes.data || []) as Exam[],
      allSubjects: (subjectsRes.data || []) as Subject[],
    };

  } catch (error: any) {
    console.error("Error in getTeacherStudentScoresPageInitialDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function getStudentsForClassAction(classId: string, schoolId: string): Promise<{
  ok: boolean;
  message?: string;
  students?: Student[];
}> {
  if (!classId || !schoolId) {
    return { ok: false, message: "Class ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId);
    
    if (error) throw error;
    return { ok: true, students: (data || []) as Student[] };
  } catch (error: any) {
    console.error("Error in getStudentsForClassAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function getScoresForExamAndClassAction(
  examId: string,
  classId: string,
  schoolId: string,
  studentIds: string[]
): Promise<{
  ok: boolean;
  message?: string;
  scores?: Record<string, string | number>;
}> {
  if (!examId || !classId || !schoolId || studentIds.length === 0) {
    return { ok: true, scores: {} }; 
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: fetchedScoresData, error } = await supabase
      .from('student_scores')
      .select('student_id, score')
      .eq('exam_id', examId)
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .in('student_id', studentIds);

    if (error) throw error;

    const scoresMap: Record<string, string | number> = {};
    (fetchedScoresData || []).forEach(fetchedScore => {
      scoresMap[fetchedScore.student_id] = fetchedScore.score;
    });
    return { ok: true, scores: scoresMap };
  } catch (error: any) {
    console.error("Error in getScoresForExamAndClassAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function saveStudentScoresAction(scoresToSave: SaveScoreInput[]): Promise<{ ok: boolean; message: string; savedCount: number }> {
  const supabaseAdmin = createSupabaseServerClient();
  if (!scoresToSave || scoresToSave.length === 0) {
    return { ok: true, message: 'No scores provided to save.', savedCount: 0 };
  }

  let savedCount = 0;
  const errors: string[] = [];
  
  for (const scoreInput of scoresToSave) {
    if (typeof scoreInput.score === 'string' && scoreInput.score.trim() === '') {
        continue; 
    }
    
    const { data: existingScore, error: fetchError } = await supabaseAdmin
      .from('student_scores')
      .select('id')
      .eq('student_id', scoreInput.student_id)
      .eq('exam_id', scoreInput.exam_id)
      .eq('class_id', scoreInput.class_id) 
      .eq('school_id', scoreInput.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
      errors.push(`Error checking existing score for student ${scoreInput.student_id}: ${fetchError.message}`);
      continue;
    }

    const recordData = {
      student_id: scoreInput.student_id,
      exam_id: scoreInput.exam_id,
      subject_id: scoreInput.subject_id,
      class_id: scoreInput.class_id,
      score: String(scoreInput.score), 
      max_marks: scoreInput.max_marks,
      recorded_by_teacher_id: scoreInput.recorded_by_teacher_id,
      date_recorded: new Date().toISOString().split('T')[0],
      school_id: scoreInput.school_id,
    };

    let operationError = null;
    if (existingScore) { 
      const { error } = await supabaseAdmin
        .from('student_scores')
        .update(recordData)
        .eq('id', existingScore.id);
      operationError = error;
    } else { 
      const { error } = await supabaseAdmin
        .from('student_scores')
        .insert(recordData);
      operationError = error;
    }

    if (operationError) {
      errors.push(`Error saving score for student ${scoreInput.student_id}: ${operationError.message}`);
    } else {
      savedCount++;
      try {
        const { data: studentEmailData } = await supabaseAdmin.from('students').select('email').eq('id', scoreInput.student_id).single();
        const { data: examDetails } = await supabaseAdmin.from('exams').select('name, subject_id').eq('id', scoreInput.exam_id).single();
        const { data: subjectDetails } = examDetails?.subject_id ? await supabaseAdmin.from('subjects').select('name').eq('id', examDetails.subject_id).single() : { data: null };
        
        if (studentEmailData?.email) {
          const examName = examDetails?.name || 'Unknown Exam';
          const subjectNameText = subjectDetails?.name ? ` (Subject: ${subjectDetails.name})` : '';
          const emailSubject = `Exam Score Declared: ${examName}`;
          const emailBody = `
            <h1>Exam Score Update</h1>
            <p>Your score for the exam "<strong>${examName}</strong>"${subjectNameText} has been declared/updated.</p>
            <p><strong>Score:</strong> ${scoreInput.score}${scoreInput.max_marks ? ` / ${scoreInput.max_marks}` : ''}</p>
            <p>Please log in to CampusHub to view your detailed results.</p>
          `;
          await sendEmail({
            to: studentEmailData.email,
            subject: emailSubject,
            html: emailBody,
          });
        }
      } catch (emailError: any) {
        console.error(`Failed to send score notification to student ${scoreInput.student_id}:`, emailError.message);
      }
    }
  }

  if (errors.length > 0) {
    return { 
      ok: false, 
      message: `Saved ${savedCount} scores. Encountered errors: ${errors.join('; ')}`,
      savedCount 
    };
  }

  if (savedCount > 0) {
    revalidatePath('/teacher/student-scores');
    revalidatePath('/admin/student-scores'); 
    revalidatePath('/student/my-scores'); 
  }
  
  return { ok: true, message: `Successfully saved/updated ${savedCount} student scores.`, savedCount };
}
