
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { ClassScheduleDB, ClassData, Subject, Teacher, UserRole } from '@/types'; // Use DB types
import emailjs from 'emailjs-com';
import { getStudentEmailsByClassId, getTeacherEmailByTeacherProfileId } from '@/services/emailService';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("EmailJS service configured in class-schedule/actions.ts.");
} else {
  console.warn(
    "EmailJS is not fully configured in class-schedule/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`--- MOCK EMAIL SEND REQUEST (class-schedule/actions.ts) ---`);
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
      console.error(`Error sending email to ${recipientEmail} with EmailJS from class-schedule/actions.ts:`, error);
      messages.push(`Failed to send email to ${recipientEmail}: ${error.text || error.message || 'Unknown error'}`);
      allSuccessful = false;
    }
  }
  return { success: allSuccessful, message: messages.join(' ') };
}


interface ClassScheduleInput {
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string; // e.g., 'Monday', 'Tuesday'
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
}

export async function fetchClassSchedulePageData(schoolId: string): Promise<{
  ok: boolean;
  schedules?: ClassScheduleDB[];
  activeClasses?: ClassData[];
  subjects?: Subject[];
  teachers?: Teacher[];
  message?: string;
}> {
  if (!schoolId) return { ok: false, message: "School ID is required." };
  const supabase = createSupabaseServerClient();
  try {
    const [schedulesRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
      supabase.from('class_schedules').select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)').eq('school_id', schoolId).order('day_of_week').order('start_time'),
      supabase.from('classes').select('id, name, division').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name, code').eq('school_id', schoolId).order('name'),
      supabase.from('teachers').select('id, name, subject').eq('school_id', schoolId).order('name'),
    ]);

    if (schedulesRes.error) throw new Error(`Fetching schedules failed: ${schedulesRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);
    
    return {
      ok: true,
      schedules: schedulesRes.data || [],
      activeClasses: classesRes.data || [],
      subjects: subjectsRes.data || [],
      teachers: teachersRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in fetchClassSchedulePageData:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}


export async function addClassScheduleAction(
  input: ClassScheduleInput
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('class_schedules')
      .insert(input)
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error adding class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');

    // Send email notification
    if (data) {
      const schedule = data as ClassScheduleDB & { 
        class?: { name: string, division: string }, 
        subject?: { name: string }, 
        teacher?: { name: string } 
      };
      const className = schedule.class ? `${schedule.class.name} - ${schedule.class.division}` : 'N/A';
      const subjectName = schedule.subject?.name || 'N/A';
      const teacherName = schedule.teacher?.name || 'N/A';

      const emailSubject = `New Class Scheduled: ${subjectName} on ${schedule.day_of_week}`;
      const emailBody = `
        <h1>New Class Added to Schedule</h1>
        <p>A new class has been scheduled:</p>
        <ul>
          <li><strong>Class:</strong> ${className}</li>
          <li><strong>Subject:</strong> ${subjectName}</li>
          <li><strong>Teacher:</strong> ${teacherName}</li>
          <li><strong>Day:</strong> ${schedule.day_of_week}</li>
          <li><strong>Time:</strong> ${schedule.start_time} - ${schedule.end_time}</li>
        </ul>
        <p>Please check the school timetable for full details.</p>
      `;

      const studentEmails = await getStudentEmailsByClassId(schedule.class_id, schedule.school_id);
      const teacherEmail = await getTeacherEmailByTeacherProfileId(schedule.teacher_id);
      
      const recipientEmails = [...studentEmails];
      if (teacherEmail) recipientEmails.push(teacherEmail);

      if (recipientEmails.length > 0) {
        await sendEmail({
          to: recipientEmails,
          subject: emailSubject,
          html: emailBody,
        });
      }
    }

    return { ok: true, message: 'Class schedule added successfully.', schedule: data as ClassScheduleDB };
  } catch (e: any) {
    console.error("Unexpected error adding schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function updateClassScheduleAction(
  id: string,
  input: Partial<ClassScheduleInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('class_schedules')
      .update(input)
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error updating class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    // Optionally, send update notification emails here, similar to addClassScheduleAction
    return { ok: true, message: 'Class schedule updated successfully.', schedule: data as ClassScheduleDB };
  } catch (e: any) {
    console.error("Unexpected error updating schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function deleteClassScheduleAction(id: string, school_id: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error } = await supabase
      .from('class_schedules')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) {
      console.error("Error deleting class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    // Optionally, send cancellation notification emails here
    return { ok: true, message: 'Class schedule deleted successfully.' };
  } catch (e: any) {
    console.error("Unexpected error deleting schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
