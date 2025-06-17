// src/services/emailService.ts
'use server';

import emailjs from 'emailjs-com';
import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  // text?: string; // EmailJS primarily works with HTML content via templates
}

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID; // This will be your single generic template
const USER_ID = process.env.EMAILJS_PUBLIC_KEY; // Or EMAILJS_USER_ID, depending on what you named it

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  // emailjs.init(USER_ID); // Not strictly necessary if passing USER_ID to send method, but good for default.
  console.log("EmailJS service configured.");
} else {
  console.warn(
    "EmailJS is not fully configured. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY/USER_ID) are missing. Emails will be mocked."
  );
}

/**
 * Sends an email using EmailJS if configured, otherwise logs a mock request.
 * Assumes a single EmailJS template with variables like:
 * {{to_email}}, {{subject_line}}, {{html_body}}, {{from_name}} (optional)
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log("--- MOCK EMAIL SEND REQUEST (EmailJS not configured) ---");
    console.log("To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log("Subject:", options.subject);
    // console.log("HTML Body:", options.html); // Log HTML for debugging mock
    console.log("--- END MOCK EMAIL ---");
    return { success: true, message: "Email sending is mocked as EmailJS is not configured." };
  }

  const sendToAddresses = Array.isArray(options.to) ? options.to : [options.to];
  let allSuccessful = true;
  let messages: string[] = [];

  for (const recipientEmail of sendToAddresses) {
    const templateParams = {
      to_email: recipientEmail, // Your EmailJS template should use this for the 'to' field if necessary
      subject_line: options.subject,
      html_body: options.html,
      from_name: 'CampusHub Notifications', // Optional: if your template uses it
      reply_to: recipientEmail, // Good practice for EmailJS
    };

    try {
      // Note: For server-side with emailjs-com, you often use an Access Token / Private Key,
      // but USER_ID (Public Key) can work for basic sends.
      // If you have a private key, you'd typically use it with emailjs.init() or a different SDK.
      // We'll proceed with USER_ID as per common `emailjs-com` client-side pattern.
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, USER_ID);
      messages.push(`Email successfully sent to ${recipientEmail}.`);
    } catch (error: any) {
      console.error(`Error sending email to ${recipientEmail} with EmailJS:`, error);
      messages.push(`Failed to send email to ${recipientEmail}: ${error.text || error.message || 'Unknown error'}`);
      allSuccessful = false;
    }
  }

  return { success: allSuccessful, message: messages.join(' ') };
}


// Helper functions to fetch email addresses - remain the same
export async function getStudentEmailsByClassId(classId: string, schoolId: string): Promise<string[]> {
  if (!classId || !schoolId) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('email')
    .eq('class_id', classId)
    .eq('school_id', schoolId);
  if (error || !data) {
    console.error("Error fetching student emails by class ID:", error);
    return [];
  }
  return data.map(s => s.email).filter(email => !!email) as string[];
}

export async function getTeacherEmailByTeacherProfileId(teacherProfileId: string): Promise<string | null> {
  if (!teacherProfileId) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('email')
    .eq('id', teacherProfileId) 
    .single();
  if (error || !data) {
    console.error("Error fetching teacher email by teacher profile ID:", error);
    return null;
  }
  return data.email;
}

export async function getAllUserEmailsInSchool(schoolId: string, roles?: UserRole[]): Promise<string[]> {
  if (!schoolId) return [];
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('users')
    .select('email')
    .eq('school_id', schoolId);

  if (roles && roles.length > 0) {
    query = query.in('role', roles);
  }
  
  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching all user emails in school:", error);
    return [];
  }
  return data.map(u => u.email).filter(email => !!email) as string[];
}

