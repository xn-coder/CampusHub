
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AdmissionStatus, AdmissionRecord, ClassData } from '@/types';

export async function fetchAdminSchoolIdForAdmissions(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("fetchAdminSchoolIdForAdmissions: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school for admissions:", error?.message);
    return null;
  }
  return school.id;
}

export async function fetchAdmissionPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  admissions?: AdmissionRecord[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { data: admissionsData, error: admissionsError } = await supabaseAdmin
      .from('admission_records')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (admissionsError) {
      console.error("Error fetching admissions data action:", admissionsError);
      return { ok: false, message: `Failed to fetch admissions: ${admissionsError.message}` };
    }

    const { data: classesData, error: classesError } = await supabaseAdmin
      .from('classes')
      .select('id, name, division') // Only fetch needed fields
      .eq('school_id', schoolId);

    if (classesError) {
      console.error("Error fetching classes data action:", classesError);
      return { ok: false, message: `Failed to fetch classes: ${classesError.message}` };
    }

    return { ok: true, admissions: admissionsData || [], classes: classesData || [] };
  } catch (error: any) {
    console.error("Unexpected error in fetchAdmissionPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}


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
