
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Installment } from '@/types';

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
    // Optional: Check for dependencies before deleting
    // const { count, error: depError } = await supabase
    //   .from('student_fee_payments')
    //   .select('id', { count: 'exact', head: true })
    //   .eq('installment_id', id)
    //   .eq('school_id', schoolId);
    // if (depError) throw depError;
    // if (count && count > 0) {
    //   return { ok: false, message: `Cannot delete: This installment is used in ${count} fee record(s).` };
    // }

    const { error } = await supabase
      .from('installments')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw error;
    
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: 'Installment deleted successfully.' };
  } catch (e: any) {
    console.error("Error deleting installment:", e);
    return { ok: false, message: `Failed to delete installment: ${e.message}` };
  }
}
