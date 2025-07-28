
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

const BATCH_SIZE = 50; // Resend's limit is 50 per call

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; message: string }> {
  if (!resend) {
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    console.log(`--- [LOG emailService] MOCK EMAIL SEND REQUEST ---`);
    console.log(`To: ${recipients.length} recipient(s)`);
    if (recipients.length < 10) {
      console.log(`(${recipients.join(', ')})`);
    }
    console.log("Subject:", payload.subject);
    console.log("HTML Body (first 200 chars):", payload.html.substring(0, 200) + (payload.html.length > 200 ? "..." : ""));
    console.log("--- [LOG emailService] END MOCK EMAIL ---");
    return { ok: true, message: "Email sending is mocked due to missing or invalid Resend configuration. Check server logs." };
  }

  const fromAddress = 'CampusHub <onboarding@resend.dev>';
  const isProduction = process.env.NODE_ENV === 'production';
  const sandboxEmail = process.env.RESEND_SANDBOX_EMAIL;
  
  const allRecipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  let finalRecipients: string[];

  if (isProduction) {
    finalRecipients = allRecipients;
  } else {
    if (sandboxEmail) {
      console.log(`[LOG emailService] Development/Sandbox mode: Redirecting all emails to ${sandboxEmail}`);
      finalRecipients = [sandboxEmail];
    } else {
      console.log(`[LOG emailService] Development mode: Redirecting all emails to delivered@resend.dev. Set RESEND_SANDBOX_EMAIL in .env to use your own test address.`);
      finalRecipients = ['delivered@resend.dev'];
    }
  }

  // Chunk the recipients into batches of BATCH_SIZE
  const emailBatches: string[][] = [];
  for (let i = 0; i < finalRecipients.length; i += BATCH_SIZE) {
    emailBatches.push(finalRecipients.slice(i, i + BATCH_SIZE));
  }
  
  if (!isProduction && emailBatches.length > 1) {
    console.log(`[LOG emailService] Development mode: sending only one test batch instead of ${emailBatches.length}.`);
    emailBatches.splice(1); // Only send one batch in dev
  }

  try {
    const results = await Promise.all(
      emailBatches.map(batch => 
        resend!.emails.send({
          from: fromAddress,
          to: batch,
          subject: payload.subject,
          html: payload.html,
        })
      )
    );

    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('[LOG emailService] Resend errors:', JSON.stringify(errors, null, 2));
      return { ok: false, message: `Resend API Error: ${errors.map(e => e.error?.message).join('; ')}` };
    }

    const totalSent = allRecipients.length;
    console.log(`[LOG emailService] Email(s) sent successfully via Resend to ${isProduction ? totalSent : 1} recipient(s).`);
    return { ok: true, message: 'Email(s) sent successfully via Resend.' };

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

export async function getAllAdminEmails(): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'admin');
  
  if (error || !data) {
    console.error("[LOG emailService] Error fetching all admin emails:", error);
    return [];
  }
  return data.map(u => u.email).filter(Boolean) as string[];
}
