
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Concession, StudentFeePayment, Student, FeeCategory, ClassData } from '@/types';


export async function getManageConcessionsPageData(schoolId: string): Promise<{
    ok: boolean;
    concessions?: Concession[];
    assignedConcessions?: any[];
    students?: Student[];
    classes?: ClassData[];
    message?: string;
}> {
    if (!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    try {
        const [concessionsRes, assignedConcessionsRes, studentsRes, classesRes] = await Promise.all([
            supabase.from('concessions').select('*').eq('school_id', schoolId),
            supabase.from('student_fee_concessions').select('*, student:student_id(name), fee_payment:student_fee_payment_id(fee_category:fee_category_id(name)), concession:concession_id(title)').eq('school_id', schoolId),
            supabase.from('students').select('id, name, class_id').eq('school_id', schoolId),
            supabase.from('classes').select('id, name, division').eq('school_id', schoolId),
        ]);

        if (concessionsRes.error) throw new Error(`Concessions: ${concessionsRes.error.message}`);
        if (assignedConcessionsRes.error) throw new Error(`Assigned Concessions: ${assignedConcessionsRes.error.message}`);
        if (studentsRes.error) throw new Error(`Students: ${studentsRes.error.message}`);
        if (classesRes.error) throw new Error(`Classes: ${classesRes.error.message}`);

        return {
            ok: true,
            concessions: concessionsRes.data || [],
            assignedConcessions: assignedConcessionsRes.data || [],
            students: studentsRes.data || [],
            classes: classesRes.data || [],
        };
    } catch (e: any) {
        return { ok: false, message: `Failed to load page data: ${e.message}` };
    }
}


export async function createConcessionAction(input: Omit<Concession, 'id'>): Promise<{ ok: boolean; message: string; concession?: Concession }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error, data } = await supabase.from('concessions').insert({ ...input, id: uuidv4() }).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-concessions');
    return { ok: true, message: 'Concession created successfully.', concession: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to create concession: ${e.message}` };
  }
}

export async function updateConcessionAction(id: string, input: Partial<Omit<Concession, 'id'>>): Promise<{ ok: boolean; message: string; concession?: Concession }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error, data } = await supabase.from('concessions').update(input).eq('id', id).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-concessions');
    return { ok: true, message: 'Concession updated successfully.', concession: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to update concession: ${e.message}` };
  }
}

export async function deleteConcessionAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('student_fee_concessions').select('id', { count: 'exact', head: true }).eq('concession_id', id);
    if(count && count > 0) return { ok: false, message: `Cannot delete: this concession is applied to ${count} fee record(s).`};

    const { error } = await supabase.from('concessions').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    revalidatePath('/admin/manage-concessions');
    return { ok: true, message: 'Concession deleted successfully.' };
  } catch (e: any) {
    return { ok: false, message: `Failed to delete concession: ${e.message}` };
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


interface AssignConcessionInput {
  student_id: string;
  fee_payment_id: string;
  concession_id: string;
  amount: number;
  school_id: string;
  applied_by_user_id: string;
}

export async function assignConcessionAction(input: AssignConcessionInput): Promise<{ ok: boolean; message: string; }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: fee, error: fetchError } = await supabase.from('student_fee_payments').select('assigned_amount, paid_amount').eq('id', input.fee_payment_id).single();
        if (fetchError || !fee) return { ok: false, message: "Fee record not found." };
        if (input.amount > (fee.assigned_amount - fee.paid_amount)) return { ok: false, message: "Concession cannot be greater than the outstanding amount."};

        // This would be a transaction in a real application
        // 1. Record the concession
        const { error: concessionError } = await supabase.from('student_fee_concessions').insert({
            id: uuidv4(),
            student_fee_payment_id: input.fee_payment_id,
            concession_id: input.concession_id,
            student_id: input.student_id,
            school_id: input.school_id,
            concession_amount: input.amount,
            applied_by_user_id: input.applied_by_user_id,
        });
        if (concessionError) throw new Error(`Failed to record concession: ${concessionError.message}`);
        
        // 2. Adjust the fee payment record
        const newPaidAmount = fee.paid_amount + input.amount;
        const newStatus: PaymentStatus = newPaidAmount >= fee.assigned_amount ? 'Paid' : 'Partially Paid';
        
        const { error: updateError } = await supabase.from('student_fee_payments')
            .update({ paid_amount: newPaidAmount, status: newStatus, notes: `Concession applied: ${input.amount}` })
            .eq('id', input.fee_payment_id);
        if (updateError) throw new Error(`Failed to update fee record: ${updateError.message}`);

        revalidatePath('/admin/manage-concessions');
        revalidatePath('/admin/student-fees');
        return { ok: true, message: `Successfully applied concession of ₹${input.amount.toFixed(2)}.` };
    } catch(e: any) {
        console.error("Error applying concession:", e);
        // Here you would rollback the transaction if it failed
        return { ok: false, message: e.message || "Failed to apply concession."};
    }
}
