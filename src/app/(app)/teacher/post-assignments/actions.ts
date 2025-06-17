
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Assignment, UserRole } from '@/types';
import emailjs from 'emailjs-com';
import { getStudentEmailsByClassId } from '@/services/emailService';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("EmailJS service configured in teacher/post-assignments/actions.ts.");
} else {
  console.warn(
    "EmailJS is not fully configured in teacher/post-assignments/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`--- MOCK EMAIL SEND REQUEST (teacher/post-assignments/actions.ts) ---`);
    console.log("To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log("Subject:", options.subject);
    console.log("--- END MOCK EMAIL ---");
    return { success: true, message: "Email sending is mocked as EmailJS is not configured." };
  }

  const sendToAddresses = Array.isArray(options.to) ? options.to : [options.to];
  let allSuccessful = true;
  let messages: string[] = [];

  for (const recipientEmail of sendToAddresses) {
    const templateParams = {
      to_email: recipientEmail,
      subject_line: options.subject,
      html_body: options.html,
      from_name: 'CampusHub Notifications',
      reply_to: recipientEmail,
    };

    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, USER_ID);
      messages.push(`Email successfully sent to ${recipientEmail}.`);
    } catch (error: any) {
      console.error(`Error sending email to ${recipientEmail} with EmailJS from teacher/post-assignments/actions.ts:`, error);
      messages.push(`Failed to send email to ${recipientEmail}: ${error.text || error.message || 'Unknown error'}`);
      allSuccessful = false;
    }
  }
  return { success: allSuccessful, message: messages.join(' ') };
}


const NO_SUBJECT_VALUE_INTERNAL = "__NO_SUBJECT__";

interface PostAssignmentInput {
  title: string;
  description?: string;
  due_date: string; // YYYY-MM-DD
  class_id: string;
  teacher_id: string; 
  subject_id?: string; 
  school_id: string;
}

export async function postAssignmentAction(
  input: PostAssignmentInput
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const assignmentId = uuidv4();
  
  const { data, error } = await supabase
    .from('assignments')
    .insert({ 
        id: assignmentId, 
        ...input,
        subject_id: (input.subject_id === NO_SUBJECT_VALUE_INTERNAL || !input.subject_id) ? null : input.subject_id,
    })
    .select('*, class:class_id(name,division), subject:subject_id(name)')
    .single();

  if (error) {
    console.error("Error posting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/post-assignments');
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments'); 

  if (data && data.class_id && data.school_id) {
    const assignment = data as Assignment & { class?: { name: string, division: string }, subject?: { name: string | null } };
    const studentEmails = await getStudentEmailsByClassId(assignment.class_id, assignment.school_id);
    
    if (studentEmails.length > 0) {
      const className = assignment.class ? `${assignment.class.name} - ${assignment.class.division}` : 'your class';
      const emailSubject = `New Assignment Posted: ${assignment.title}`;
      const emailBody = `
        <h1>New Assignment Posted</h1>
        <p>A new assignment has been posted by your teacher:</p>
        <ul>
          <li><strong>Title:</strong> ${assignment.title}</li>
          <li><strong>For Class:</strong> ${className}</li>
          ${assignment.subject?.name ? `<li><strong>Subject:</strong> ${assignment.subject.name}</li>` : ''}
          <li><strong>Due Date:</strong> ${new Date(assignment.due_date).toLocaleDateString()}</li>
        </ul>
        <p>Please log in to CampusHub to view the details and submit your work.</p>
        <p>Description: ${assignment.description || 'No description provided.'}</p>
      `;
      
      await sendEmail({
        to: studentEmails,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }

  return { ok: true, message: 'Assignment posted successfully.', assignment: data as Assignment };
}


export async function getTeacherAssignmentsAction(teacherId: string, schoolId: string): Promise<{ ok: boolean; message?: string; assignments?: Assignment[] }> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('assignments')
        .select('*, class:class_id(name,division), subject:subject_id(name)')
        .eq('teacher_id', teacherId)
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false });

    if (error) {
        console.error("Error fetching assignments:", error);
        return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, assignments: (data || []) as Assignment[] };
}

interface UpdateAssignmentInput extends Omit<Partial<PostAssignmentInput>, 'teacher_id' | 'school_id'> {
  id: string;
  teacher_id: string;
  school_id: string;
}


export async function updateAssignmentAction(
  input: UpdateAssignmentInput
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const { id, teacher_id, school_id, ...updateData } = input;

  const { error, data } = await supabase
    .from('assignments')
    .update({ 
        ...updateData,
        subject_id: (updateData.subject_id === NO_SUBJECT_VALUE_INTERNAL || !updateData.subject_id) ? null : updateData.subject_id,
     })
    .eq('id', id)
    .eq('teacher_id', teacher_id) 
    .eq('school_id', school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/teacher/post-assignments'); 
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment updated successfully.', assignment: data as Assignment };
}

export async function deleteAssignmentAction(assignmentId: string, teacherId: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const { count: submissionCount, error: submissionCheckError } = await supabase
    .from('lms_assignment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .eq('school_id', schoolId);

  if (submissionCheckError) {
    console.error("Error checking assignment submissions:", submissionCheckError);
    return { ok: false, message: `Error checking dependencies: ${submissionCheckError.message}` };
  }
  if (submissionCount && submissionCount > 0) {
    return { ok: false, message: `Cannot delete assignment: It has ${submissionCount} student submission(s) associated with it.` };
  }
  
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId) 
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment deleted successfully.' };
}
