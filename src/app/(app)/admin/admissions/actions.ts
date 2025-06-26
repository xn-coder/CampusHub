
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AdmissionStatus, AdmissionRecord, ClassData, StudentFeePayment, FeeCategory } from '@/types';

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
  feeCategories?: FeeCategory[];
  feePayments?: StudentFeePayment[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [admissionsRes, classesRes, feeCategoriesRes, feePaymentsRes] = await Promise.all([
        supabaseAdmin.from('admission_records').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabaseAdmin.from('classes').select('id, name, division').eq('school_id', schoolId),
        supabaseAdmin.from('fee_categories').select('id, name').eq('school_id', schoolId),
        supabaseAdmin.from('student_fee_payments').select('*').eq('school_id', schoolId),
    ]);

    if (admissionsRes.error) throw new Error(`Failed to fetch admissions: ${admissionsRes.error.message}`);
    if (classesRes.error) throw new Error(`Failed to fetch classes: ${classesRes.error.message}`);
    if (feeCategoriesRes.error) throw new Error(`Failed to fetch fee categories: ${feeCategoriesRes.error.message}`);
    if (feePaymentsRes.error) throw new Error(`Failed to fetch fee payments: ${feePaymentsRes.error.message}`);
    
    return { 
        ok: true, 
        admissions: admissionsRes.data || [], 
        classes: classesRes.data || [],
        feeCategories: feeCategoriesRes.data || [],
        feePayments: feePaymentsRes.data || [],
    };
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
