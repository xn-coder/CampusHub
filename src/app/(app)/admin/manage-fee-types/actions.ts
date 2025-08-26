
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeType, StudentFeePayment, PaymentStatus, FeeTypeInstallmentType } from '@/types';

interface FeeTypeInput {
  name: string;
  display_name: string;
  description?: string;
  installment_type: FeeTypeInstallmentType;
  fee_category_id: string;
  is_refundable: boolean;
  school_id: string;
}

export async function getFeeTypesAction(schoolId: string): Promise<{ ok: boolean; message?: string; feeTypes?: FeeType[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('fee_types')
      .select('*, fee_category:fee_category_id(name)')
      .eq('school_id', schoolId)
      .order('name');

    if (error) {
      if (error.message.includes('relation "public.fee_types" does not exist')) {
          console.warn("fee_types table does not exist. Please run migration. Returning empty array.");
          return { ok: true, feeTypes: [] };
      }
      throw error;
    }
    return { ok: true, feeTypes: data as any[] || [] };
  } catch (e: any) {
    console.error("Error fetching fee types:", e);
    return { ok: false, message: `Failed to fetch fee types: ${e.message}` };
  }
}

export async function createFeeTypeAction(
  input: FeeTypeInput
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('fee_types')
      .select('id')
      .eq('name', input.name.trim())
      .eq('school_id', input.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (fetchError.message.includes('relation "public.fee_types" does not exist')) {
          return { ok: false, message: 'Database setup incomplete. The fee_types table is missing.' };
      }
      throw fetchError;
    }
    if (existing) {
      return { ok: false, message: `A fee type with the name "${input.name.trim()}" already exists.` };
    }
    
    const { error, data } = await supabase
      .from('fee_types')
      .insert({ ...input, id: uuidv4() })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee Type created successfully.', feeType: data as FeeType };
  } catch (e: any) {
    console.error("Error creating fee type:", e);
    return { ok: false, message: `Failed to create fee type: ${e.message}` };
  }
}

export async function updateFeeTypeAction(
  id: string,
  input: Partial<FeeTypeInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const supabase = createSupabaseServerClient();
  try {
    if (input.name) {
      const { data: existing, error: fetchError } = await supabase
        .from('fee_types')
        .select('id')
        .eq('name', input.name.trim())
        .eq('school_id', input.school_id)
        .neq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      if (existing) {
        return { ok: false, message: `Another fee type with the name "${input.name.trim()}" already exists.` };
      }
    }
    
    const { error, data } = await supabase
      .from('fee_types')
      .update(input)
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee Type updated successfully.', feeType: data as FeeType };
  } catch (e: any) {
    console.error("Error updating fee type:", e);
    return { ok: false, message: `Failed to update fee type: ${e.message}` };
  }
}

export async function deleteFeeTypeAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
     const { count, error: depError } = await supabase
      .from('student_fee_payments')
      .select('id', { count: 'exact', head: true })
      .eq('fee_type_id', id)
      .eq('school_id', schoolId);

    if (depError) {
      if (!depError.message.includes('relation "public.student_fee_payments" does not exist')) {
        return { ok: false, message: `Error checking dependencies: ${depError.message}` };
      }
    }
    if (count && count > 0) {
      return { ok: false, message: `Cannot delete: This fee type is used in ${count} student fee record(s).` };
    }

    const { error } = await supabase.from('fee_types').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: 'Fee Type deleted successfully.' };
  } catch (e: any) {
    console.error("Error deleting fee type:", e);
    return { ok: false, message: `Failed to delete fee type: ${e.message}` };
  }
}

export async function getAssignedFeesForFeeTypeAction(schoolId: string): Promise<{
    ok: boolean;
    fees?: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[];
    message?: string;
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('student_fee_payments')
            .select(`
                *,
                student:student_id(name, email),
                fee_category:fee_category_id(name),
                fee_type:fee_type_id(name)
            `)
            .eq('school_id', schoolId)
            .not('fee_type_id', 'is', null);
        
        if (error) throw error;
        return { ok: true, fees: data as any[] };
    } catch (e: any) {
        return { ok: false, message: `Failed to fetch assigned fees: ${e.message}` };
    }
}


interface AssignFeeTypeInput {
  student_ids: string[];
  fee_type_id: string;
  amount: number;
  due_date?: string;
  school_id: string;
}

export async function assignFeeTypeToStudentsAction(
  input: AssignFeeTypeInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const supabase = createSupabaseServerClient();
    const { student_ids, fee_type_id, amount, due_date, school_id } = input;

    if (student_ids.length === 0 || !fee_type_id) {
        return { ok: false, message: "Students and a Fee Type must be selected.", assignmentsCreated: 0 };
    }
    
     const { data: feeTypeData, error: feeTypeError } = await supabase
      .from('fee_types')
      .select('name')
      .eq('id', fee_type_id)
      .single();
    if(feeTypeError || !feeTypeData) return {ok: false, message: "Selected fee type not found.", assignmentsCreated: 0};


    try {
      const feeRecordsToInsert = student_ids.map(studentId => ({
        id: uuidv4(),
        student_id: studentId,
        // When assigning a "Fee Type", we link it and also create a placeholder category.
        fee_category_id: null, // Or handle this differently if a base category is required
        fee_type_id: fee_type_id,
        assigned_amount: amount,
        due_date: due_date,
        notes: `Fee for: ${feeTypeData.name}`,
        school_id: school_id,
        paid_amount: 0,
        status: 'Pending' as PaymentStatus,
      }));

      if (feeRecordsToInsert.length === 0) {
        return { ok: true, message: "No new fees to assign.", assignmentsCreated: 0 };
      }

      const { error: insertError, count } = await supabase
        .from('student_fee_payments')
        .insert(feeRecordsToInsert);

      if (insertError) throw insertError;
      
      revalidatePath('/admin/manage-fee-types');
      revalidatePath('/admin/student-fees');
      return { ok: true, message: `Successfully assigned fees to ${count || 0} student(s).`, assignmentsCreated: count || 0 };
    } catch (e: any) {
        console.error("Error in assignFeeTypeToStudentsAction:", e);
        return { ok: false, message: e.message, assignmentsCreated: 0 };
    }
}
