
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Exam, Subject, ClassData, AcademicYear, UserRole } from '@/types';
import emailjs from 'emailjs-com';
import { getStudentEmailsByClassId, getAllUserEmailsInSchool } from '@/services/emailService';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("EmailJS service configured in exams/actions.ts.");
} else {
  console.warn(
    "EmailJS is not fully configured in exams/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`--- MOCK EMAIL SEND REQUEST (exams/actions.ts) ---`);
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
      console.error(`Error sending email to ${recipientEmail} with EmailJS from exams/actions.ts:`, error);
      messages.push(`Failed to send email to ${recipientEmail}: ${error.text || error.message || 'Unknown error'}`);
      allSuccessful = false;
    }
  }
  return { success: allSuccessful, message: messages.join(' ') };
}


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

export async function getExamsPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  exams?: Exam[];
  subjects?: Subject[];
  activeClasses?: ClassData[];
  academicYears?: AcademicYear[];
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [examsRes, subjectsRes, classesRes, academicYearsRes] = await Promise.all([
      supabaseAdmin.from('exams').select('*, subject:subject_id(name), class:class_id(name,division)').eq('school_id', schoolId).order('date', { ascending: false }), // Eager load subject and class for notifications
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);

    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);

    return {
      ok: true,
      schoolId,
      exams: examsRes.data || [],
      subjects: subjectsRes.data || [],
      activeClasses: classesRes.data || [],
      academicYears: academicYearsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getExamsPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

interface ExamInput {
  name: string;
  subject_id: string;
  class_id?: string | null; 
  academic_year_id?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  max_marks?: number | null;
  school_id: string;
}

export async function addExamAction(
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examId = uuidv4();
  
  const examData = {
    ...input,
    id: examId,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };

  const { error, data } = await supabaseAdmin
    .from('exams')
    .insert(examData)
    .select('*, subject:subject_id(name), class:class_id(name,division)') // Eager load for notification
    .single();

  if (error) {
    console.error("Error adding exam:", error);
    return { ok: false, message: `Failed to add exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');

  // Send email notification
  if (data) {
    const exam = data as Exam & { subject?: { name: string }, class?: { name: string, division: string } };
    const subjectName = exam.subject?.name || 'N/A';
    const className = exam.class ? `${exam.class.name} - ${exam.class.division}` : 'All Classes';
    
    const emailSubject = `New Exam Scheduled: ${exam.name} for ${subjectName}`;
    const emailBody = `
      <h1>New Exam Scheduled</h1>
      <p>An exam has been scheduled:</p>
      <ul>
        <li><strong>Exam Name:</strong> ${exam.name}</li>
        <li><strong>Subject:</strong> ${subjectName}</li>
        <li><strong>Class:</strong> ${className}</li>
        <li><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString()}</li>
        ${exam.start_time ? `<li><strong>Time:</strong> ${exam.start_time}${exam.end_time ? ` - ${exam.end_time}` : ''}</li>` : ''}
        ${exam.max_marks ? `<li><strong>Max Marks:</strong> ${exam.max_marks}</li>` : ''}
      </ul>
      <p>Please prepare accordingly.</p>
    `;
    
    let recipientEmails: string[] = [];
    if (exam.class_id && exam.school_id) {
      recipientEmails = await getStudentEmailsByClassId(exam.class_id, exam.school_id);
    } else if (exam.school_id) {
      recipientEmails = await getAllUserEmailsInSchool(exam.school_id, ['student', 'teacher']);
    }

    if (recipientEmails.length > 0) {
      await sendEmail({
        to: recipientEmails,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }

  return { ok: true, message: 'Exam scheduled successfully.', exam: data as Exam };
}

export async function updateExamAction(
  id: string,
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examData = {
    ...input,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { school_id, ...updatePayload } = examData;


  const { error, data } = await supabaseAdmin
    .from('exams')
    .update(updatePayload)
    .eq('id', id)
    .eq('school_id', input.school_id)
    .select('*, subject:subject_id(name), class:class_id(name,division)')
    .single();

  if (error) {
    console.error("Error updating exam:", error);
    return { ok: false, message: `Failed to update exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');

  if (data) {
    const exam = data as Exam & { subject?: { name: string }, class?: { name: string, division: string } };
    const subjectName = exam.subject?.name || 'N/A';
    const className = exam.class ? `${exam.class.name} - ${exam.class.division}` : 'All Classes';
    
    const emailSubject = `Exam Updated: ${exam.name} for ${subjectName}`;
    const emailBody = `
      <h1>Exam Schedule Updated</h1>
      <p>Details for the following exam have been updated:</p>
      <ul>
        <li><strong>Exam Name:</strong> ${exam.name}</li>
        <li><strong>Subject:</strong> ${subjectName}</li>
        <li><strong>Class:</strong> ${className}</li>
        <li><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString()}</li>
        ${exam.start_time ? `<li><strong>Time:</strong> ${exam.start_time}${exam.end_time ? ` - ${exam.end_time}` : ''}</li>` : ''}
        ${exam.max_marks ? `<li><strong>Max Marks:</strong> ${exam.max_marks}</li>` : ''}
      </ul>
      <p>Please review the changes.</p>
    `;
    
    let recipientEmails: string[] = [];
    if (exam.class_id && exam.school_id) {
      recipientEmails = await getStudentEmailsByClassId(exam.class_id, exam.school_id);
    } else if (exam.school_id) {
      recipientEmails = await getAllUserEmailsInSchool(exam.school_id, ['student', 'teacher']);
    }

    if (recipientEmails.length > 0) {
      await sendEmail({
        to: recipientEmails,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }

  return { ok: true, message: 'Exam updated successfully.', exam: data as Exam };
}

export async function deleteExamAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { count, error: depError } = await supabaseAdmin
    .from('student_scores')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', id)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking exam dependencies (student_scores):", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete exam: It has ${count} student score(s) associated with it.` };
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { ok: false, message: `Failed to delete exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam deleted successfully.' };
}
    
