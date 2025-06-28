
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
