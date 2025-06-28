
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
    // We set status to 'Terminated' and unassign them from their class.
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ status: 'Terminated', class_id: null })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error terminating student profile:', studentUpdateError);
      return { ok: false, message: `Database error on student profile: ${studentUpdateError.message}` };
    }
    
    // Deactivate the user account to prevent login
    const { error: userUpdateError } = await supabase
        .from('users')
        .update({ status: 'Inactive' })
        .eq('id', userId);

    if (userUpdateError) {
        console.error('Error deactivating user account:', userUpdateError);
        return { ok: false, message: `Student profile terminated, but failed to deactivate user login: ${userUpdateError.message}` };
    }


    revalidatePath('/admin/manage-students');
    // Also revalidate other pages where student lists might appear
    revalidatePath('/class-management');
    revalidatePath('/admin/attendance');
    
    return { ok: true, message: 'Student terminated and account deactivated successfully.' };

  } catch (e: any) {
    console.error('Unexpected error terminating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}
