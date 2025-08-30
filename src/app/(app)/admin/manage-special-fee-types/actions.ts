
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeType, StudentFeePayment, PaymentStatus, FeeTypeInstallmentType, Student, FeeCategory, ClassData } from '@/types';

// This file is specifically for SPECIAL FEE TYPES, which are of type 'extra_charge'

export async function getSpecialFeeTypesPageDataAction(schoolId: string): Promise<{ 
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
    const [feeTypesRes, assignedFeesRes, studentsRes, feeCategoriesRes, classesRes] = await Promise.all([
        supabase.from('fee_types').select('*, fee_category:fee_category_id(name)').eq('school_id', schoolId).eq('installment_type', 'extra_charge'),
        supabase.from('student_fee_payments').select('*, student:student_id(name, email), fee_category:fee_category_id(name), fee_type:fee_type_id(name)').eq('school_id', schoolId).not('fee_type_id', 'is', null),
        supabase.from('students').select('*').eq('school_id', schoolId),
        supabase.from('fee_categories').select('*').eq('school_id', schoolId),
        supabase.from('classes').select('*').eq('school_id', schoolId),
    ]);
    
    if (feeTypesRes.error) throw new Error(`Fee Types: ${feeTypesRes.error.message}`);
    if (assignedFeesRes.error) throw new Error(`Assigned Fees: ${assignedFeesRes.error.message}`);
    if (studentsRes.error) throw new Error(`Students: ${studentsRes.error.message}`);
    if (feeCategoriesRes.error) throw new Error(`Fee Categories: ${feeCategoriesRes.error.message}`);
    if (classesRes.error) throw new Error(`Classes: ${classesRes.error.message}`);

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

export async function createSpecialFeeTypeAction(input: Omit<FeeType, 'id' | 'installment_type'>): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase.from('fee_types').insert({ ...input, id: uuidv4(), installment_type: 'extra_charge' }).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-special-fee-types');
    return { ok: true, message: 'Special fee type created.', feeType: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to create special fee type: ${e.message}` };
  }
}

export async function updateSpecialFeeTypeAction(id: string, input: Partial<Omit<FeeType, 'id'>>): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    const { installment_type, ...updateData } = input;
    const { data, error } = await supabase.from('fee_types').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-special-fee-types');
    return { ok: true, message: 'Special fee type updated.', feeType: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to update special fee type: ${e.message}` };
  }
}

export async function deleteSpecialFeeTypeAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('fee_type_id', id);
    if (count && count > 0) return { ok: false, message: `Cannot delete: this type is used in ${count} fee record(s).` };

    const { error } = await supabase.from('fee_types').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    revalidatePath('/admin/manage-special-fee-types');
    return { ok: true, message: 'Special fee type deleted.' };
  } catch (e: any) {
    return { ok: false, message: `Failed to delete special fee type: ${e.message}` };
  }
}


export async function assignSpecialFeeTypeToStudentsAction(input: { student_ids: string[], fee_type_id: string, amount: number, due_date?: string, school_id: string }): Promise<{ ok: boolean; message: string; assignmentsCreated?: number }> {
    const { student_ids, fee_type_id, amount, due_date, school_id } = input;
    if (student_ids.length === 0 || !fee_type_id || amount <= 0) {
        return { ok: false, message: "Students, a fee type, and a valid amount must be selected." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data: feeType, error: feeTypeError } = await supabase.from('fee_types').select('fee_category_id').eq('id', fee_type_id).single();
        if (feeTypeError || !feeType) return { ok: false, message: "Fee type not found." };
        
        const newAssignments = student_ids.map(studentId => ({
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
        
        const { error: insertError, count } = await supabase.from('student_fee_payments').insert(newAssignments);
        if (insertError) throw insertError;
        revalidatePath('/admin/manage-special-fee-types');
        revalidatePath('/admin/student-fees');
        return { ok: true, message: `Special fee assigned to ${count} student(s).`, assignmentsCreated: count || 0 };
    } catch(e: any) {
        return { ok: false, message: `Failed to assign fees: ${e.message}`};
    }
}
