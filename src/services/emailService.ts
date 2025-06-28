// src/services/emailService.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types';
import { Resend } from 'resend';


// --- Email Sending Logic ---

const resendApiKey = process.env.RESEND_API_KEY;

let resend: Resend | null = null;
if (resendApiKey && resendApiKey.startsWith('re_')) {
  try {
    resend = new Resend(resendApiKey);
    console.log("[LOG emailService] Resend IS CONFIGURED.");
  } catch(e) {
     console.error("[LOG emailService] Error initializing Resend client:", e);
     resend = null;
  }
} else {
  console.warn(
    "[LOG emailService] RESEND_API_KEY is missing or invalid. Emails will be mocked in the server logs."
  );
}

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; message: string }> {
  let { to, subject, html } = payload;
  
  if (!resend) {
    console.log(`--- [LOG emailService] MOCK EMAIL SEND REQUEST ---`);
    console.log("To:", Array.isArray(to) ? to.join(', ') : to);
    console.log("Subject:", subject);
    console.log("HTML Body (first 200 chars):", html.substring(0, 200) + (html.length > 200 ? "..." : ""));
    console.log("--- [LOG emailService] END MOCK EMAIL ---");
    return { ok: true, message: "Email sending is mocked due to missing or invalid Resend configuration. Check server logs." };
  }

  // NOTE: Resend requires a verified sending domain for production. 
  // 'onboarding@resend.dev' is for testing/development.
  const fromAddress = 'CampusHub <onboarding@resend.dev>';

  // Use Resend's test address in development to avoid domain verification issues.
  const recipient = process.env.NODE_ENV === 'production' ? to : 'delivered@resend.dev';

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: recipient,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[LOG emailService] Resend error:', JSON.stringify(error, null, 2));
      return { ok: false, message: `Resend API Error: ${(error as Error).message}` };
    }

    console.log('[LOG emailService] Email sent successfully via Resend:', data);
    return { ok: true, message: 'Email sent successfully via Resend.' };

  } catch (error: any) {
    console.error('[LOG emailService] Error processing request:', error);
    return { ok: false, message: error.message || 'Internal Server Error' };
  }
}


// --- Email Address Fetching Logic ---

export async function getStudentEmailsByClassId(classId: string, schoolId: string): Promise<string[]> {
  if (!classId || !schoolId) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('email')
    .eq('class_id', classId)
    .eq('school_id', schoolId);
  if (error || !data) {
    console.error("[LOG emailService] Error fetching student emails by class ID:", error);
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
    console.error("[LOG emailService] Error fetching teacher email by teacher profile ID:", error);
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
    console.error("[LOG emailService] Error fetching all user emails in school:", error);
    return [];
  }
  return data.map(u => u.email).filter(email => !!email) as string[];
}
