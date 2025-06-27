
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/register-student/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import type { AdmissionRecord, Student, User, AdmissionStatus, UserRole, PaymentStatus } from '@/types';

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

    // --- Assign Admission Fee ---
    try {
      const { data: admissionFeeCategory, error: feeCategoryError } = await supabaseAdmin
        .from('fee_categories')
        .select('id, amount')
        .ilike('name', '%admission%')
        .eq('school_id', schoolId)
        .limit(1)
        .single();

      if (feeCategoryError && feeCategoryError.code !== 'PGRST116') {
        console.warn(`Could not check for Admission Fee category: ${feeCategoryError.message}`);
      }

      if (admissionFeeCategory && admissionFeeCategory.amount && admissionFeeCategory.amount > 0) {
        const feePaymentId = uuidv4();
        const { error: feeInsertError } = await supabaseAdmin
          .from('student_fee_payments')
          .insert({
            id: feePaymentId,
            student_id: newStudentProfileId,
            fee_category_id: admissionFeeCategory.id,
            assigned_amount: admissionFeeCategory.amount,
            paid_amount: 0,
            status: 'Pending' as PaymentStatus,
            payment_date: null,
            due_date: new Date().toISOString().split('T')[0],
            school_id: schoolId,
          });

        if (feeInsertError) {
          console.warn(`Failed to assign PENDING Admission Fee to student ${newStudentProfileId}: ${feeInsertError.message}`);
        } else {
          console.log(`Successfully assigned PENDING Admission Fee to student ${newStudentProfileId}.`);
          revalidatePath('/admin/student-fees');
          revalidatePath('/student/payment-history');
          revalidatePath('/dashboard');
        }
      }
    } catch (feeError: any) {
      console.warn(`An error occurred during automatic fee assignment: ${feeError.message}`);
    }
    // --- End Fee Assignment ---
    
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
    
    try {
      console.log(`[registerStudentAction] Attempting to send welcome email via API to: ${email.trim()}`);
      const emailApiUrl = new URL('/api/send-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002').toString();
      const apiResponse = await fetch(emailApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email.trim(), subject: emailSubject, html: emailBody }),
      });
      const result = await apiResponse.json();
      if (!apiResponse.ok || !result.success) {
        console.error(`[registerStudentAction] Failed to send email via API: ${result.message || apiResponse.statusText}`);
      } else {
        console.log(`[registerStudentAction] Email successfully dispatched via API: ${result.message}`);
      }
    } catch (apiError: any) {
      console.error(`[registerStudentAction] Error calling email API: ${apiError.message}`);
    }

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
