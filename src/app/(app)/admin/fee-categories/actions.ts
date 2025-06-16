
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeCategory } from '@/types';

interface FeeCategoryInput {
  name: string;
  description?: string;
  amount?: number;
  school_id: string;
}

export async function getFeeCategoriesAction(schoolId: string): Promise<{ ok: boolean; message?: string; categories?: FeeCategory[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data, error } = await supabaseAdmin
    .from('fee_categories')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error("Error fetching fee categories:", error);
    return { ok: false, message: `Failed to fetch fee categories: ${error.message}` };
  }
  return { ok: true, categories: data || [] };
}


export async function createFeeCategoryAction(
  input: FeeCategoryInput
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
  const supabaseAdmin = createSupabaseServerClient();
  const categoryId = uuidv4();

  const { data: existingCategory, error: fetchError } = await supabaseAdmin
    .from('fee_categories')
    .select('id')
    .eq('name', input.name.trim())
    .eq('school_id', input.school_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error checking existing fee category:', fetchError);
    return { ok: false, message: 'Database error while checking category name.' };
  }
  if (existingCategory) {
    return { ok: false, message: `A fee category with the name "${input.name.trim()}" already exists for this school.` };
  }
  
  const { error, data } = await supabaseAdmin
    .from('fee_categories')
    .insert({ ...input, id: categoryId })
    .select()
    .single();

  if (error) {
    console.error("Error creating fee category:", error);
    return { ok: false, message: `Failed to create fee category: ${error.message}` };
  }
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category created successfully.', category: data as FeeCategory };
}

export async function updateFeeCategoryAction(
  id: string,
  input: Partial<FeeCategoryInput> & { school_id: string } // school_id is required for scoping the update
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
  const supabaseAdmin = createSupabaseServerClient();

  if (input.name) {
    const { data: existingCategory, error: fetchError } = await supabaseAdmin
      .from('fee_categories')
      .select('id')
      .eq('name', input.name.trim())
      .eq('school_id', input.school_id)
      .neq('id', id) // Exclude the current category being updated
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing fee category name during update:', fetchError);
      return { ok: false, message: 'Database error while checking category name uniqueness.' };
    }
    if (existingCategory) {
      return { ok: false, message: `Another fee category with the name "${input.name.trim()}" already exists for this school.` };
    }
  }
  
  const { error, data } = await supabaseAdmin
    .from('fee_categories')
    .update(input)
    .eq('id', id)
    .eq('school_id', input.school_id) // Ensure update is scoped
    .select()
    .single();

  if (error) {
    console.error("Error updating fee category:", error);
    return { ok: false, message: `Failed to update fee category: ${error.message}` };
  }
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category updated successfully.', category: data as FeeCategory };
}

export async function deleteFeeCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // Check for dependencies (e.g., if this category is used in student_fee_payments)
  const { count, error: depError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('id', { count: 'exact', head: true })
    .eq('fee_category_id', id)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking fee category dependencies:", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete: This fee category is used in ${count} student fee record(s).` };
  }

  const { error } = await supabaseAdmin
    .from('fee_categories')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting fee category:", error);
    return { ok: false, message: `Failed to delete fee category: ${error.message}` };
  }
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category deleted successfully.' };
}

    