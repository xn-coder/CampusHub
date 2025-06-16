
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AdmissionStatus } from '@/types';

export async function updateAdmissionStatusAction(
  admissionId: string,
  newStatus: AdmissionStatus,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  const { error } = await supabaseAdmin
    .from('admission_records')
    .update({ status: newStatus })
    .eq('id', admissionId)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error updating admission status:", error);
    return { ok: false, message: `Failed to update admission status: ${error.message}` };
  }

  revalidatePath('/admin/admissions');
  return { ok: true, message: `Admission status updated to ${newStatus}.` };
}

// If enrolling a student from admission also means creating/linking to a student profile,
// that logic would be more complex and involve the 'students' and 'users' tables.
// For now, this action only updates the status on the admission_records table.
// The student registration process (`teacher/register-student/actions.ts`) directly sets 'Enrolled'.

    