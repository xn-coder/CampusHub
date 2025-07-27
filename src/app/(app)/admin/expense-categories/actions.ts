
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ExpenseCategory } from '@/types';

interface ExpenseCategoryInput {
  name: string;
  description?: string;
  school_id: string;
}

export async function getExpenseCategoriesAction(schoolId: string): Promise<{ ok: boolean; message?: string; categories?: ExpenseCategory[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data, error } = await supabaseAdmin
    .from('expense_categories')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error("Error fetching expense categories:", error);
    return { ok: false, message: `Failed to fetch expense categories: ${error.message}` };
  }
  return { ok: true, categories: data || [] };
}


export async function createExpenseCategoryAction(
  input: ExpenseCategoryInput
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const supabaseAdmin = createSupabaseServerClient();
  const categoryId = uuidv4();

  const { data: existingCategory, error: fetchError } = await supabaseAdmin
    .from('expense_categories')
    .select('id')
    .eq('name', input.name.trim())
    .eq('school_id', input.school_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error checking existing expense category:', fetchError);
    return { ok: false, message: 'Database error while checking category name.' };
  }
  if (existingCategory) {
    return { ok: false, message: `An expense category with the name "${input.name.trim()}" already exists for this school.` };
  }
  
  const { error, data } = await supabaseAdmin
    .from('expense_categories')
    .insert({ ...input, id: categoryId })
    .select()
    .single();

  if (error) {
    console.error("Error creating expense category:", error);
    return { ok: false, message: `Failed to create expense category: ${error.message}` };
  }
  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category created successfully.', category: data as ExpenseCategory };
}

export async function updateExpenseCategoryAction(
  id: string,
  input: Partial<ExpenseCategoryInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const supabaseAdmin = createSupabaseServerClient();

  if (input.name) {
    const { data: existingCategory, error: fetchError } = await supabaseAdmin
      .from('expense_categories')
      .select('id')
      .eq('name', input.name.trim())
      .eq('school_id', input.school_id)
      .neq('id', id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing expense category name during update:', fetchError);
      return { ok: false, message: 'Database error while checking category name uniqueness.' };
    }
    if (existingCategory) {
      return { ok: false, message: `Another expense category with the name "${input.name.trim()}" already exists for this school.` };
    }
  }
  
  const { error, data } = await supabaseAdmin
    .from('expense_categories')
    .update(input)
    .eq('id', id)
    .eq('school_id', input.school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating expense category:", error);
    return { ok: false, message: `Failed to update expense category: ${error.message}` };
  }
  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category updated successfully.', category: data as ExpenseCategory };
}

export async function deleteExpenseCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // Check for dependencies
  const { count, error: depError } = await supabaseAdmin
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking expense category dependencies:", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete: This category is used in ${count} expense record(s).` };
  }

  const { error } = await supabaseAdmin
    .from('expense_categories')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting expense category:", error);
    return { ok: false, message: `Failed to delete expense category: ${error.message}` };
  }
  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category deleted successfully.' };
}
