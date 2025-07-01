
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function terminateStudentAction(
  studentId: string,
  userId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !userId || !schoolId) {
    return { ok: false, message: 'Student ID, User ID, and School ID are required.' };
  }

  const supabase = createSupabaseServerClient();
  try {
    // Step 1: Update student profile
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ status: 'Terminated', class_id: null })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error terminating student profile:', studentUpdateError);
      if (studentUpdateError.message.includes('column "status" does not exist')) {
        return {
          ok: false,
          message: "Database migration needed: 'status' column is missing from the 'students' table. Please run the required SQL migration.",
        };
      }
      return { ok: false, message: `Database error on student profile: ${studentUpdateError.message}` };
    }

    // Step 2: Deactivate user account
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ status: 'Inactive' })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error deactivating user account:', userUpdateError);
      if (userUpdateError.message.includes('column "status" does not exist')) {
        return {
          ok: false,
          message: "Database migration needed: 'status' column is missing from the 'users' table. Please run the required SQL migration.",
        };
      }
      return {
        ok: false,
        message: `Student profile terminated, but failed to deactivate user login: ${userUpdateError.message}`,
      };
    }

    // Step 3: Revalidate paths and return success
    revalidatePath('/admin/manage-students');
    revalidatePath('/class-management');
    revalidatePath('/admin/attendance');

    return { ok: true, message: 'Student terminated and account deactivated successfully.' };
  } catch (e: any) {
    console.error('Unexpected error terminating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}

export async function reactivateStudentAction(
  studentId: string,
  userId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !userId || !schoolId) {
    return { ok: false, message: 'Student ID, User ID, and School ID are required.' };
  }

  const supabase = createSupabaseServerClient();
  try {
    // Step 1: Reactivate student profile
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ status: 'Active' })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error reactivating student profile:', studentUpdateError);
      return { ok: false, message: `Database error on student profile: ${studentUpdateError.message}` };
    }

    // Step 2: Reactivate user account
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ status: 'Active' })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error reactivating user account:', userUpdateError);
      return {
        ok: false,
        message: `Student profile reactivated, but failed to reactivate user login: ${userUpdateError.message}`,
      };
    }

    // Step 3: Revalidate paths and return success
    revalidatePath('/admin/manage-students');

    return { ok: true, message: 'Student reactivated and account enabled successfully.' };
  } catch (e: any) {
    console.error('Unexpected error reactivating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}

interface UpdateStudentInput {
  studentId: string;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  roll_number: string | null;
  class_id: string | null;
}

export async function updateStudentAction(
  input: UpdateStudentInput
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { studentId, userId, schoolId, name, email, roll_number, class_id } = input;

  try {
    // 1. Check if the new email is already taken by another user in the same school
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .eq('school_id', schoolId)
      .neq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing user by email:', fetchError);
      return { ok: false, message: 'Database error checking email uniqueness.' };
    }
    if (existingUser) {
      return { ok: false, message: `Another user with the email ${email.trim()} already exists in this school.` };
    }

    // 2. Update the student's profile in the 'students' table
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({
        name: name.trim(),
        email: email.trim(),
        roll_number: roll_number || null,
        class_id: class_id,
      })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error updating student profile:', studentUpdateError);
      return { ok: false, message: `Failed to update student profile: ${studentUpdateError.message}` };
    }

    // 3. Update the corresponding user record in the 'users' table
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        email: email.trim(),
      })
      .eq('id', userId);

    if (userUpdateError) {
      // This is not a critical failure; the main student profile was updated. Log a warning.
      console.warn(`Student profile ${studentId} updated, but failed to associated user login ${userId}: ${userUpdateError.message}`);
    }

    revalidatePath('/admin/manage-students');
    return { ok: true, message: 'Student details updated successfully.' };

  } catch (e: any) {
    console.error('Unexpected error updating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}
