
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Installment, StudentFeePayment } from '@/types';

interface InstallmentInput {
  title: string;
  start_date: string;
  end_date: string;
  last_date: string;
  description?: string;
  school_id: string;
}

export async function getInstallmentsAction(schoolId: string): Promise<{ ok: boolean; message?: string; installments?: Installment[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    if (error) {
      if (error.message.includes('relation "public.installments" does not exist')) {
          console.warn("Installments table does not exist. Please run migration. Returning empty array.");
          return { ok: true, installments: [] }; // Gracefully handle missing table
      }
      throw error;
    }
    return { ok: true, installments: data || [] };
  } catch (e: any) {
    console.error("Error fetching installments:", e);
    return { ok: false, message: `Failed to fetch installments: ${e.message}` };
  }
}

export async function createInstallmentAction(
  input: InstallmentInput
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const supabase = createSupabaseServerClient();
  const installmentId = uuidv4();

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('installments')
      .select('id')
      .eq('title', input.title.trim())
      .eq('school_id', input.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (fetchError.message.includes('relation "public.installments" does not exist')) {
          console.warn("Create failed: Installments table not found.");
          return { ok: false, message: 'Database setup incomplete. The installments table is missing.' };
      }
      throw fetchError;
    }
    if (existing) {
      return { ok: false, message: `An installment with the title "${input.title.trim()}" already exists for this school.` };
    }
    
    const { error, data } = await supabase
      .from('installments')
      .insert({ ...input, id: installmentId })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment created successfully.', installment: data as Installment };
  } catch (e: any) {
    console.error("Error creating installment:", e);
    return { ok: false, message: `Failed to create installment: ${e.message}` };
  }
}

export async function updateInstallmentAction(
  id: string,
  input: Partial<InstallmentInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const supabase = createSupabaseServerClient();
  try {
    if (input.title) {
      const { data: existing, error: fetchError } = await supabase
        .from('installments')
        .select('id')
        .eq('title', input.title.trim())
        .eq('school_id', input.school_id)
        .neq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      if (existing) {
        return { ok: false, message: `Another installment with the title "${input.title.trim()}" already exists.` };
      }
    }
    
    const { error, data } = await supabase
      .from('installments')
      .update(input)
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment updated successfully.', installment: data as Installment };
  } catch (e: any) {
    console.error("Error updating installment:", e);
    return { ok: false, message: `Failed to update installment: ${e.message}` };
  }
}

export async function deleteInstallmentAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error } = await supabase
      .from('installments')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) {
        if(error.code === '23503') { // foreign_key_violation
            return { ok: false, message: "Cannot delete this installment because it is currently assigned to one or more student fee records."};
        }
        throw error;
    }
    
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment deleted successfully.' };
  } catch (e: any) {
    console.error("Error deleting installment:", e);
    return { ok: false, message: `Failed to delete installment: ${e.message}` };
  }
}


export async function getAssignedFeesAction(schoolId: string): Promise<{
    ok: boolean;
    fees?: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, installment: {title: string}})[];
    message?: string;
}> {
    if(!schoolId) {
        return { ok: false, message: "School ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('student_fee_payments')
            .select(`
                *,
                student:student_id(name, email),
                fee_category:fee_category_id(name),
                installment:installment_id(title)
            `)
            .eq('school_id', schoolId)
            .not('installment_id', 'is', null) // Only fetch fees that are assigned to an installment
            .order('due_date', { ascending: false });
        
        if (error) throw error;

        return { ok: true, fees: data as any[] };
    } catch (e: any) {
        console.error("Error fetching assigned fees:", e);
        return { ok: false, message: `Failed to fetch assigned fees: ${e.message}` };
    }
}
