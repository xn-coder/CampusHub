'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function terminateStudentAction(
  studentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !schoolId) {
    return { ok: false, message: 'Student ID and School ID are required.' };
  }

  const supabase = createSupabaseServerClient();
  try {
    // We set status to 'Terminated' and unassign them from their class.
    const { error } = await supabase
      .from('students')
      .update({ status: 'Terminated', class_id: null })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (error) {
      console.error('Error terminating student:', error);
      return { ok: false, message: `Database error: ${error.message}` };
    }

    revalidatePath('/admin/manage-students');
    // Also revalidate other pages where student lists might appear
    revalidatePath('/class-management');
    revalidatePath('/admin/attendance');
    
    return { ok: true, message: 'Student terminated successfully. They can no longer log in and are unassigned from their class.' };

  } catch (e: any) {
    console.error('Unexpected error terminating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}
