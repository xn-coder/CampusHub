
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/register-student/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import type { AdmissionRecord, Student, User, AdmissionStatus, UserRole } from '@/types';
import emailjs from 'emailjs-com';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY;

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("[LOG] EmailJS IS CONFIGURED in src/app/(app)/teacher/register-student/actions.ts");
} else {
  console.warn(
    "[LOG] EmailJS IS NOT CONFIGURED in src/app/(app)/teacher/register-student/actions.ts. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
  );
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  console.log(`[LOG sendEmail_entry - src/app/(app)/teacher/register-student/actions.ts] Called. isEmailJsConfigured: ${isEmailJsConfigured}. Options subject: ${options.subject}`);
  
  if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
    console.log(`[LOG sendEmail_mock - src/app/(app)/teacher/register-student/actions.ts] Mocking email.`);
    console.log(" MOCK To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
    console.log(" MOCK Subject:", options.subject);
    console.log(" MOCK HTML Body:", options.html.substring(0, 200) + (options.html.length > 200 ? "..." : ""));
    return { success: true, message: "Email sending is mocked as EmailJS is not configured." };
  }

  const sendToAddresses = Array.isArray(options.to) ? options.to : [options.to];
  let allSuccessful = true;
  const detailedMessages: string[] = [];

  console.log(`[LOG sendEmail_attempt - src/app/(app)/teacher/register-student/actions.ts] Attempting to send ${sendToAddresses.length} email(s) via EmailJS.`);

  for (const recipientEmail of sendToAddresses) {
    const templateParams = {
      to_email: recipientEmail,
      subject_line: options.subject,
      html_body: options.html,
      from_name: 'CampusHub Notifications',
      reply_to: recipientEmail,
    };

    try {
      console.log(`[LOG sendEmail_sending - src/app/(app)/teacher/register-student/actions.ts] Sending to ${recipientEmail}`);
      const response = await emailjs.send(SERVICE_ID!, TEMPLATE_ID!, templateParams, USER_ID!);
      console.log(`[LOG sendEmail_success - src/app/(app)/teacher/register-student/actions.ts] EmailJS success for ${recipientEmail}: Status ${response.status}, Text: ${response.text}`);
      detailedMessages.push(`Email successfully sent to ${recipientEmail}.`);
    } catch (error: any) {
      console.error(`[LOG sendEmail_error - src/app/(app)/teacher/register-student/actions.ts] Failed for ${recipientEmail}. Status: ${error?.status}, Text: ${error?.text}. Full error:`, error);
      detailedMessages.push(`Failed for ${recipientEmail}: ${error?.text || error?.message || 'Unknown EmailJS error'}`);
      allSuccessful = false;
    }
  }
  
  const overallMessage = allSuccessful 
    ? `Successfully sent ${sendToAddresses.length} email(s).` 
    : `Email sending attempted. Results: ${detailedMessages.join('; ')}`;
  
  console.log(`[LOG sendEmail_return - src/app/(app)/teacher/register-student/actions.ts] Returning:`, { success: allSuccessful, message: overallMessage });
  return { success: allSuccessful, message: overallMessage };
}


const SALT_ROUNDS = 10;

interface RegisterStudentInput {
  name: string;
  email: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  classId: string; 
  schoolId: string;
  profilePictureUrl?: string;
}

export async function registerStudentAction(
  input: RegisterStudentInput
): Promise<{ ok: boolean; message: string; studentId?: string; userId?: string; admissionRecordId?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { 
    name, email, dateOfBirth, guardianName, contactNumber, address, classId, schoolId, profilePictureUrl 
  } = input;
  const defaultPassword = "password";

  try {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
      console.error('Error checking existing user:', userFetchError);
      return { ok: false, message: 'Database error while checking user email.' };
    }
    if (existingUser) {
      return { ok: false, message: `A user with email ${email.trim()} already exists.` };
    }

    const newUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
    const { data: newUser, error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        email: email.trim(),
        name: name.trim(),
        role: 'student',
        password_hash: hashedPassword,
        school_id: schoolId,
      })
      .select('id')
      .single();

    if (userInsertError || !newUser) {
      console.error('Error creating user account:', userInsertError);
      return { ok: false, message: `Failed to create student login: ${userInsertError?.message || 'No user data returned'}` };
    }

    const newStudentProfileId = uuidv4();
    const { error: studentInsertError } = await supabaseAdmin
      .from('students')
      .insert({
        id: newStudentProfileId,
        user_id: newUser.id,
        name: name.trim(),
        email: email.trim(),
        class_id: classId,
        date_of_birth: dateOfBirth || null,
        guardian_name: guardianName || null,
        contact_number: contactNumber || null,
        address: address || null,
        admission_date: new Date().toISOString().split('T')[0],
        profile_picture_url: profilePictureUrl?.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`,
        school_id: schoolId,
      });

    if (studentInsertError) {
      console.error('Error creating student profile:', studentInsertError);
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      return { ok: false, message: `Failed to create student profile: ${studentInsertError.message}` };
    }
    
    const newAdmissionId = uuidv4();
    const { error: admissionInsertError } = await supabaseAdmin
        .from('admission_records')
        .insert({
            id: newAdmissionId,
            name: name.trim(),
            email: email.trim(),
            date_of_birth: dateOfBirth || null,
            guardian_name: guardianName || null,
            contact_number: contactNumber || null,
            address: address || null,
            admission_date: new Date().toISOString().split('T')[0],
            status: 'Enrolled' as AdmissionStatus, 
            class_id: classId,
            student_profile_id: newStudentProfileId,
            school_id: schoolId,
        });
    
    if (admissionInsertError) {
        console.warn('Error creating admission record:', admissionInsertError);
    }

    const emailSubject = "Welcome to CampusHub!";
    const emailBody = `
      <h1>Welcome, ${name.trim()}!</h1>
      <p>Your account has been successfully created at CampusHub.</p>
      <p>You can now log in to the portal using the following credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${email.trim()}</li>
        <li><strong>Password:</strong> ${defaultPassword}</li>
      </ul>
      <p>We recommend changing your password after your first login.</p>
      <p>Thank you for joining us!</p>
    `;
    
    console.log(`[registerStudentAction] Attempting to send welcome email to: ${email.trim()}`);
    await sendEmail({
      to: email.trim(),
      subject: emailSubject,
      html: emailBody,
    });

    revalidatePath('/teacher/register-student');
    revalidatePath('/admin/manage-students'); 
    revalidatePath('/admin/admissions'); 

    return { 
      ok: true, 
      message: `Student ${name} registered and account created. Default password: "password". A welcome email has been sent.`,
      studentId: newStudentProfileId,
      userId: newUser.id,
      admissionRecordId: newAdmissionId,
    };

  } catch (error: any) {
    console.error('Unexpected error during student registration:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
