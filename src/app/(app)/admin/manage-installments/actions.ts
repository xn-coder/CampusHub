
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Installment, StudentFeePayment, PaymentStatus, Student, FeeCategory, ClassData } from '@/types';


export async function getManageInstallmentsPageData(schoolId: string): Promise<{
    ok: boolean;
    installments?: Installment[];
    students?: Student[];
    feeCategories?: FeeCategory[];
    classes?: ClassData[];
    assignedFees?: any[];
    message?: string;
}> {
    if (!schoolId) {
        return { ok: false, message: "School ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const [installmentsRes, studentsRes, feeCategoriesRes, classesRes, assignedFeesRes] = await Promise.all([
            supabase.from('installments').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
            supabase.from('students').select('id, name, class_id').eq('school_id', schoolId),
            supabase.from('fee_categories').select('id, name, amount').eq('school_id', schoolId),
            supabase.from('classes').select('id, name, division').eq('school_id', schoolId),
            supabase.from('student_fee_payments')
                .select(`*, student:student_id(name), fee_category:fee_category_id(name), installment:installment_id(title)`)
                .eq('school_id', schoolId)
                .not('installment_id', 'is', null)
        ]);

        if (installmentsRes.error) throw new Error(`Installments: ${installmentsRes.error.message}`);
        if (studentsRes.error) throw new Error(`Students: ${studentsRes.error.message}`);
        if (feeCategoriesRes.error) throw new Error(`Fee Categories: ${feeCategoriesRes.error.message}`);
        if (classesRes.error) throw new Error(`Classes: ${classesRes.error.message}`);
        if (assignedFeesRes.error) throw new Error(`Assigned Fees: ${assignedFeesRes.error.message}`);

        return {
            ok: true,
            installments: installmentsRes.data || [],
            students: studentsRes.data || [],
            feeCategories: feeCategoriesRes.data || [],
            classes: classesRes.data || [],
            assignedFees: assignedFeesRes.data || [],
        };
    } catch (e: any) {
        return { ok: false, message: `Failed to load page data: ${e.message}` };
    }
}


export async function createInstallmentAction(
  input: Omit<Installment, 'id'>
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error, data } = await supabase.from('installments').insert({ ...input, id: uuidv4() }).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment created successfully.', installment: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to create installment: ${e.message}` };
  }
}

export async function updateInstallmentAction(
  id: string,
  input: Partial<Omit<Installment, 'id'>>
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error, data } = await supabase.from('installments').update(input).eq('id', id).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment updated successfully.', installment: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to update installment: ${e.message}` };
  }
}

export async function deleteInstallmentAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    // Check for dependencies before deleting
    const { count } = await supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('installment_id', id);
    if(count && count > 0) {
        return { ok: false, message: `Cannot delete: this installment is used in ${count} fee record(s).`};
    }
    
    const { error } = await supabase.from('installments').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment deleted successfully.' };
  } catch (e: any) {
    return { ok: false, message: `Failed to delete installment: ${e.message}` };
  }
}

export async function getFeesForStudentsAction(studentIds: string[], schoolId: string): Promise<{ ok: boolean; fees?: (StudentFeePayment & {fee_category: FeeCategory | null})[]; message?: string }> {
    if (!studentIds || !schoolId || studentIds.length === 0) return { ok: true, fees: [] };
    const supabase = createSupabaseServerClient();
    try {
      const { data, error } = await supabase
        .from('student_fee_payments')
        .select('*, fee_category:fee_category_id(id, name, amount)')
        .in('student_id', studentIds)
        .eq('school_id', schoolId)
        .neq('status', 'Paid'); // Only show fees that are not fully paid
      if (error) throw error;
      return { ok: true, fees: data as any[] };
    } catch(e: any) {
      return { ok: false, message: `Error fetching student fees: ${e.message}` };
    }
}


interface AssignFeesToInstallmentInput {
  student_ids: string[];
  fees_to_assign: { category_id: string; amount: number }[];
  installment_id: string;
  due_date?: string;
  school_id: string;
  academic_year_id?: string;
  notes?: string;
}

export async function assignFeesToInstallmentAction(
  input: AssignFeesToInstallmentInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const { student_ids, fees_to_assign, installment_id, school_id, ...rest } = input;
    const supabase = createSupabaseServerClient();

    if (student_ids.length === 0 || fees_to_assign.length === 0) {
        return { ok: false, message: "Students and Fee Categories must be selected.", assignmentsCreated: 0 };
    }
    
    const assignmentsToInsert: Omit<StudentFeePayment, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    for (const studentId of student_ids) {
        for (const fee of fees_to_assign) {
            assignmentsToInsert.push({
                student_id: studentId,
                fee_category_id: fee.category_id,
                installment_id,
                school_id,
                assigned_amount: fee.amount,
                paid_amount: 0,
                status: 'Pending',
                ...rest,
            });
        }
    }

    if (assignmentsToInsert.length === 0) {
      return { ok: true, message: "No new assignments to create.", assignmentsCreated: 0 };
    }

    try {
      const { error, count } = await supabase.from('student_fee_payments').insert(assignmentsToInsert);
      if (error) throw error;
      
      revalidatePath('/admin/manage-installments');
      revalidatePath('/admin/student-fees');

      return { ok: true, message: `Successfully created ${count} new fee assignments.`, assignmentsCreated: count || 0 };
    } catch(e: any) {
        return { ok: false, message: `Failed to create assignments: ${e.message}`, assignmentsCreated: 0};
    }
}
