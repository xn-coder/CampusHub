
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeType, StudentFeePayment, PaymentStatus, FeeTypeInstallmentType, Student, FeeCategory, ClassData } from '@/types';

export async function getFeeTypesPageDataAction(schoolId: string): Promise<{ 
    ok: boolean; 
    feeTypes?: (FeeType & { fee_category: { name: string } | null })[],
    assignedFees?: any[],
    students?: Student[],
    classes?: ClassData[],
    feeCategories?: FeeCategory[],
    message?: string 
}> {
  if (!schoolId) return { ok: false, message: "School ID is required." };
  const supabase = createSupabaseServerClient();
  try {
    const [feeTypesRes, studentsRes, feeCategoriesRes, classesRes] = await Promise.all([
        supabase.from('fee_types').select('*, fee_category:fee_category_id(name)').eq('school_id', schoolId).eq('installment_type', 'installments'),
        supabase.from('students').select('*').eq('school_id', schoolId),
        supabase.from('fee_categories').select('*').eq('school_id', schoolId),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
    ]);
    
    if (feeTypesRes.error) throw new Error(`Fee Types: ${feeTypesRes.error.message}`);
    if (studentsRes.error) throw new Error(`Students: ${studentsRes.error.message}`);
    if (feeCategoriesRes.error) throw new Error(`Fee Categories: ${feeCategoriesRes.error.message}`);
    if (classesRes.error) throw new Error(`Classes: ${classesRes.error.message}`);
    
    const installmentFeeTypeIds = (feeTypesRes.data || []).map(ft => ft.id);
    let assignedFeesRes: any = { data: [], error: null };
    if (installmentFeeTypeIds.length > 0) {
        assignedFeesRes = await supabase.from('student_fee_payments')
            .select('*, student:student_id(name, email), fee_category:fee_category_id(name), fee_type:fee_type_id(name)')
            .eq('school_id', schoolId)
            .in('fee_type_id', installmentFeeTypeIds);
    }
    
    if (assignedFeesRes.error) throw new Error(`Assigned Fees: ${assignedFeesRes.error.message}`);


    return { 
        ok: true, 
        feeTypes: feeTypesRes.data as any[] || [],
        assignedFees: assignedFeesRes.data || [],
        students: studentsRes.data || [],
        classes: classesRes.data || [],
        feeCategories: feeCategoriesRes.data || [],
    };
  } catch (e: any) {
    return { ok: false, message: `Failed to load page data: ${e.message}` };
  }
}

export async function createFeeTypeAction(input: Omit<FeeType, 'id'>): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase.from('fee_types').insert({ ...input, id: uuidv4(), installment_type: 'installments' }).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee type created.', feeType: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to create fee type: ${e.message}` };
  }
}

export async function updateFeeTypeAction(id: string, input: Partial<Omit<FeeType, 'id'>>): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    // Ensure installment_type is not changed during update from this action
    const { installment_type, ...updateData } = input;
    const { data, error } = await supabase.from('fee_types').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee type updated.', feeType: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to update fee type: ${e.message}` };
  }
}

export async function deleteFeeTypeAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('fee_type_id', id);
    if (count && count > 0) {
      return { ok: false, message: `Cannot delete: this fee type is used in ${count} student fee record(s).` };
    }

    const { error } = await supabase.from('fee_types').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee type deleted.' };
  } catch (e: any) {
    return { ok: false, message: `Failed to delete fee type: ${e.message}` };
  }
}


export async function assignFeeTypeToStudentsAction(input: { student_ids: string[], fee_type_id: string, amount: number, due_date?: string, school_id: string }): Promise<{ ok: boolean; message: string; assignmentsCreated?: number, assignmentsUpdated?: number }> {
    const { student_ids, fee_type_id, amount, due_date, school_id } = input;
    if (student_ids.length === 0 || !fee_type_id || amount <= 0) {
        return { ok: false, message: "Students, a fee type, and a valid amount must be selected." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data: feeType, error: feeTypeError } = await supabase.from('fee_types').select('fee_category_id').eq('id', fee_type_id).single();
        if (feeTypeError || !feeType) return { ok: false, message: "Fee type not found." };
        
        const { data: existingRecords, error: fetchError } = await supabase
            .from('student_fee_payments')
            .select('id, student_id')
            .in('student_id', student_ids)
            .eq('fee_type_id', fee_type_id);
            
        if (fetchError) throw new Error(`DB Error checking for existing fees: ${fetchError.message}`);

        const existingStudentIds = new Set((existingRecords || []).map(r => r.student_id));
        const studentsToInsert = student_ids.filter(id => !existingStudentIds.has(id));
        const studentsToUpdate = student_ids.filter(id => existingStudentIds.has(id));
        
        let assignmentsCreated = 0;
        let assignmentsUpdated = 0;

        // Batch insert new records
        if (studentsToInsert.length > 0) {
            const newAssignments = studentsToInsert.map(studentId => ({
                id: uuidv4(),
                student_id: studentId,
                fee_category_id: feeType.fee_category_id,
                fee_type_id: fee_type_id,
                assigned_amount: amount,
                paid_amount: 0,
                due_date: due_date,
                status: 'Pending' as PaymentStatus,
                school_id: school_id
            }));
            const { count, error: insertError } = await supabase.from('student_fee_payments').insert(newAssignments);
            if (insertError) throw new Error(`Failed to insert new assignments: ${insertError.message}`);
            assignmentsCreated = count || 0;
        }

        // Batch update existing records
        if (studentsToUpdate.length > 0) {
            const { count, error: updateError } = await supabase
                .from('student_fee_payments')
                .update({ assigned_amount: amount, due_date: due_date, status: 'Pending', paid_amount: 0 })
                .in('student_id', studentsToUpdate)
                .eq('fee_type_id', fee_type_id);
            if (updateError) throw new Error(`Failed to update existing assignments: ${updateError.message}`);
            assignmentsUpdated = count || 0;
        }
        
        revalidatePath('/admin/manage-fee-types');
        revalidatePath('/admin/student-fees');
        
        return { 
            ok: true, 
            message: `Created ${assignmentsCreated} new fee records and updated ${assignmentsUpdated} existing ones.`, 
            assignmentsCreated, 
            assignmentsUpdated 
        };
    } catch(e: any) {
        return { ok: false, message: `Failed to assign fees: ${e.message}`};
    }
}

export async function updateStudentFeeAction(
  id: string,
  schoolId: string,
  updates: { assigned_amount: number, due_date?: string }
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { error } = await supabaseAdmin
    .from('student_fee_payments')
    .update(updates)
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    return { ok: false, message: `Failed to update fee: ${error.message}` };
  }
  revalidatePath('/admin/manage-fee-types');
  return { ok: true, message: 'Fee assignment updated successfully.' };
}


export async function deleteStudentFeeAssignmentAction(
  feePaymentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { data: feePayment, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('paid_amount')
    .eq('id', feePaymentId)
    .eq('school_id', schoolId)
    .single();

  if (fetchError) {
    return { ok: false, message: `Error checking fee: ${fetchError.message}` };
  }
  if (feePayment && feePayment.paid_amount > 0) {
    return { ok: false, message: "Cannot delete: This fee has payments recorded." };
  }

  const { error } = await supabaseAdmin
    .from('student_fee_payments')
    .delete()
    .eq('id', feePaymentId)
    .eq('school_id', schoolId);

  if (error) {
    return { ok: false, message: `Failed to delete fee: ${error.message}` };
  }
  revalidatePath('/admin/manage-fee-types');
  return { ok: true, message: 'Fee assignment deleted successfully.' };
}
