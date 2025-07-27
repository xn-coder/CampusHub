
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
  try {
    const { data, error } = await supabaseAdmin
      .from('expense_categories')
      .select('*')
      .eq('school_id', schoolId)
      .order('name');

    if (error) {
      if (error.message.includes('relation "public.expense_categories" does not exist')) {
          console.warn("Expense Categories table does not exist. Returning empty array.");
          return { ok: true, categories: [] }; // Gracefully handle missing table
      }
      throw error;
    }
    return { ok: true, categories: data || [] };
  } catch (e: any) {
    console.error("Error fetching expense categories:", e);
    return { ok: false, message: `Failed to fetch expense categories: ${e.message}` };
  }
}


export async function createExpenseCategoryAction(
  input: ExpenseCategoryInput
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const supabaseAdmin = createSupabaseServerClient();
  const categoryId = uuidv4();

  try {
    const { data: existingCategory, error: fetchError } = await supabaseAdmin
      .from('expense_categories')
      .select('id')
      .eq('name', input.name.trim())
      .eq('school_id', input.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      if (fetchError.message.includes('relation "public.expense_categories" does not exist')) {
          console.warn("Create failed: Expense Categories table not found. Please run the required SQL migration.");
          return { ok: false, message: 'Database setup incomplete.' };
      }
      throw fetchError;
    }
    if (existingCategory) {
      return { ok: false, message: `An expense category with the name "${input.name.trim()}" already exists for this school.` };
    }
    
    const { error, data } = await supabaseAdmin
      .from('expense_categories')
      .insert({ ...input, id: categoryId })
      .select()
      .single();

    if (error) throw error;
    
    revalidatePath('/admin/expense-categories');
    revalidatePath('/admin/expenses');
    return { ok: true, message: 'Expense category created successfully.', category: data as ExpenseCategory };
  } catch (e: any) {
     console.error("Error creating expense category:", e);
    return { ok: false, message: `Failed to create expense category: ${e.message}` };
  }
}

export async function updateExpenseCategoryAction(
  id: string,
  input: Partial<ExpenseCategoryInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const supabaseAdmin = createSupabaseServerClient();
  try {
    if (input.name) {
      const { data: existingCategory, error: fetchError } = await supabaseAdmin
        .from('expense_categories')
        .select('id')
        .eq('name', input.name.trim())
        .eq('school_id', input.school_id)
        .neq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        if (fetchError.message.includes('relation "public.expense_categories" does not exist')) {
          console.warn("Update failed: Expense Categories table not found.");
          return { ok: false, message: 'Database setup incomplete.' };
        }
        throw fetchError;
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

    if (error) throw error;

    revalidatePath('/admin/expense-categories');
    revalidatePath('/admin/expenses');
    return { ok: true, message: 'Expense category updated successfully.', category: data as ExpenseCategory };
  } catch (e: any) {
    console.error("Error updating expense category:", e);
    return { ok: false, message: `Failed to update expense category: ${e.message}` };
  }
}

export async function deleteExpenseCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  try {
    const { count, error: depError } = await supabaseAdmin
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('school_id', schoolId);

    if (depError) {
      if (depError.message.includes('relation "public.expenses" does not exist')) {
          console.warn("Expenses table does not exist, proceeding with category deletion.");
      } else {
        throw depError;
      }
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
       if (error.message.includes('relation "public.expense_categories" does not exist')) {
        console.warn("Delete skipped: Expense Categories table not found.");
        return { ok: true, message: "Category already deleted (table does not exist)." };
      }
      throw error;
    }
    
    revalidatePath('/admin/expense-categories');
    revalidatePath('/admin/expenses');
    return { ok: true, message: 'Expense category deleted successfully.' };
  } catch (e: any) {
    console.error("Error deleting expense category:", e);
    return { ok: false, message: `Failed to delete expense category: ${e.message}` };
  }
}
