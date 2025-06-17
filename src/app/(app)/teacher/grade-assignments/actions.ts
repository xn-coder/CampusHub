
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/grade-assignments/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Assignment, AssignmentSubmission, Student } from '@/types';
import { revalidatePath } from 'next/cache';
import emailjs from 'emailjs-com';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("[LOG] EmailJS IS CONFIGURED in src/app/(app)/teacher/grade-assignments/actions.ts");
} else {
  console.warn(
    "[LOG] EmailJS IS NOT CONFIGURED in src/app/(app)/teacher/grade-assignments/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  console.log(`[LOG sendEmail_entry - src/app/(app)/teacher/grade-assignments/actions.ts] Called. isEmailJsConfigured: ${isEmailJsConfigured}. Options subject: ${options.subject}`);
  
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`[LOG sendEmail_mock - src/app/(app)/teacher/grade-assignments/actions.ts] Mocking email.`);
    console.log(" MOCK To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log(" MOCK Subject:", options.subject);
    console.log(" MOCK HTML Body:", options.html.substring(0, 200) + (options.html.length > 200 ? "..." : ""));
    return { success: true, message: "Email sending is mocked as EmailJS is not configured." };
  }

  const sendToAddresses = Array.isArray(options.to) ? options.to : [options.to];
  let allSuccessful = true;
  const detailedMessages: string[] = [];

  console.log(`[LOG sendEmail_attempt - src/app/(app)/teacher/grade-assignments/actions.ts] Attempting to send ${sendToAddresses.length} email(s) via EmailJS.`);

  for (const recipientEmail of sendToAddresses) {
    const templateParams = {
      to_email: recipientEmail,
      subject_line: options.subject,
      html_body: options.html,
      from_name: 'CampusHub Notifications',
      reply_to: recipientEmail,
    };

    try {
      console.log(`[LOG sendEmail_sending - src/app/(app)/teacher/grade-assignments/actions.ts] Sending to ${recipientEmail}`);
      const response = await emailjs.send(SERVICE_ID!, TEMPLATE_ID!, templateParams, USER_ID!);
      console.log(`[LOG sendEmail_success - src/app/(app)/teacher/grade-assignments/actions.ts] EmailJS success for ${recipientEmail}: Status ${response.status}, Text: ${response.text}`);
      detailedMessages.push(`Email successfully sent to ${recipientEmail}.`);
    } catch (error: any) {
      console.error(`[LOG sendEmail_error - src/app/(app)/teacher/grade-assignments/actions.ts] Failed for ${recipientEmail}. Status: ${error?.status}, Text: ${error?.text}. Full error:`, error);
      detailedMessages.push(`Failed for ${recipientEmail}: ${error?.text || error?.message || 'Unknown EmailJS error'}`);
      allSuccessful = false;
    }
  }
  
  const overallMessage = allSuccessful 
    ? `Successfully sent ${sendToAddresses.length} email(s).` 
    : `Email sending attempted. Results: ${detailedMessages.join('; ')}`;
  
  console.log(`[LOG sendEmail_return - src/app/(app)/teacher/grade-assignments/actions.ts] Returning:`, { success: allSuccessful, message: overallMessage });
  return { success: allSuccessful, message: overallMessage };
}


interface EnrichedSubmission extends AssignmentSubmission {
  student_name: string;
  student_email: string;
}

export async function getTeacherAssignmentsForGradingAction(teacherId: string, schoolId: string): Promise<{
  ok: boolean;
  assignments?: Assignment[];
  message?: string;
}> {
  if (!teacherId || !schoolId) {
    return { ok: false, message: "Teacher ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subject:subject_id(name), class:class_id(name,division)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error("Error fetching teacher's assignments for grading:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, assignments: (data || []) as Assignment[] };
  } catch (e: any) {
    console.error("Unexpected error fetching assignments:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function getSubmissionsForAssignmentAction(assignmentId: string, schoolId: string): Promise<{
  ok: boolean;
  submissions?: EnrichedSubmission[];
  message?: string;
}> {
  if (!assignmentId || !schoolId) {
    return { ok: false, message: "Assignment ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: submissionsData, error: submissionsError } = await supabase
      .from('lms_assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('school_id', schoolId);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return { ok: false, message: `Database error fetching submissions: ${submissionsError.message}` };
    }
    if (!submissionsData || submissionsData.length === 0) {
      return { ok: true, submissions: [] };
    }

    const studentIds = submissionsData.map(s => s.student_id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, email')
      .in('id', studentIds)
      .eq('school_id', schoolId);
    
    if (studentsError) {
      console.error("Error fetching student details for submissions:", studentsError);
      return { ok: false, message: `Database error fetching student details: ${studentsError.message}` };
    }

    const enrichedSubmissions: EnrichedSubmission[] = submissionsData.map(sub => {
      const student = studentsData?.find(s => s.id === sub.student_id);
      return {
        ...sub,
        student_name: student?.name || 'Unknown Student',
        student_email: student?.email || 'N/A',
      };
    });

    return { ok: true, submissions: enrichedSubmissions };
  } catch (e: any) {
    console.error("Unexpected error fetching submissions:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}


interface SaveGradeInput {
    submission_id: string;
    grade: string;
    feedback?: string | null;
    school_id: string; 
}

export async function saveSingleGradeAndFeedbackAction(input: SaveGradeInput): Promise<{
  ok: boolean;
  message: string;
  updatedSubmission?: AssignmentSubmission;
}> {
  const supabase = createSupabaseServerClient();
  const { submission_id, grade, feedback, school_id } = input;

  if (!submission_id || !grade) {
    return { ok: false, message: "Submission ID and Grade are required." };
  }

  try {
    const { data, error } = await supabase
      .from('lms_assignment_submissions')
      .update({
        grade: grade.trim(),
        feedback: feedback?.trim() || null,
      })
      .eq('id', submission_id)
      .eq('school_id', school_id)
      .select('*, student:student_id(email), assignment:assignment_id(title)') 
      .single();

    if (error) {
      console.error("Error saving grade and feedback:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    
    revalidatePath('/teacher/grade-assignments');
    revalidatePath(`/student/assignments`); 

    if (data) {
      const submission = data as AssignmentSubmission & { student?: { email: string | null } | null, assignment?: { title: string | null } | null };
      if (submission.student?.email && submission.assignment?.title) {
        const emailSubject = `Assignment Graded: ${submission.assignment.title}`;
        const emailBody = `
          <h1>Assignment Graded</h1>
          <p>Your submission for the assignment "<strong>${submission.assignment.title}</strong>" has been graded.</p>
          <p><strong>Grade:</strong> ${submission.grade}</p>
          ${submission.feedback ? `<p><strong>Feedback:</strong> ${submission.feedback}</p>` : ''}
          <p>Please log in to CampusHub to view details.</p>
        `;
        console.log(`[saveSingleGradeAndFeedbackAction] Attempting to send grade notification to: ${submission.student.email}`);
        await sendEmail({
          to: submission.student.email,
          subject: emailSubject,
          html: emailBody,
        });
      }
    }

    return { ok: true, message: 'Grade and feedback saved successfully.', updatedSubmission: data as AssignmentSubmission };
  } catch (e: any) {
    console.error("Unexpected error saving grade:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
