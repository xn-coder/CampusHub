// src/services/emailService.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types';
import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

const emailFrom = process.env.EMAIL_FROM;
const emailHost = process.env.EMAIL_HOST;
const emailPort = Number(process.env.EMAIL_PORT || 587);
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

let transporter: nodemailer.Transporter | null = null;

if (emailHost && emailUser && emailPass && emailFrom) {
  transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
  console.log("Nodemailer transporter configured.");
} else {
  console.warn(
    "Nodemailer is not configured. Email environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM) are missing. Emails will not be sent."
  );
}

/**
 * Sends an email using Nodemailer if configured, otherwise logs a mock request.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  if (!transporter || !emailFrom) {
    console.log("--- MOCK EMAIL SEND REQUEST (Nodemailer not configured) ---");
    console.log("To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log("Subject:", options.subject);
    // console.log("HTML Body:", options.html);
    console.log("--- END MOCK EMAIL ---");
    return { success: true, message: "Email sending is mocked as Nodemailer is not configured." };
  }

  try {
    const mailOptions = {
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return { success: true, message: `Email sent successfully to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}. Message ID: ${info.messageId}` };
  } catch (error: any) {
    console.error("Error sending email with Nodemailer:", error);
    return { success: false, message: `Failed to send email: ${error.message}` };
  }
}


// Helper functions to fetch email addresses - can be expanded or moved
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
    .eq('id', teacherProfileId) // Assuming teacherProfileId is teachers.id
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
