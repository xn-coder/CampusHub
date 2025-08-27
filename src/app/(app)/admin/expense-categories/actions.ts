
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
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
    if (error) {
        if(error.message.includes('relation "public.expense_categories" does not exist')) {
            return { ok: true, categories: [], message: "Feature not ready: Expense Categories table does not exist in the database."};
        }
        throw error;
    }
    return { ok: true, categories: data || [] };
  } catch(e: any) {
    console.error("Error fetching expense categories:", e);
    return { ok: false, message: e.message || "An unexpected error occurred."};
  }
}


export async function createExpenseCategoryAction(
  input: ExpenseCategoryInput
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data: existing } = await supabase
        .from('expense_categories')
        .select('id')
        .eq('name', input.name.trim())
        .eq('school_id', input.school_id)
        .maybeSingle();
        
    if(existing) {
        return { ok: false, message: `An expense category named "${input.name}" already exists.`};
    }

    const { data, error } = await supabase
        .from('expense_categories')
        .insert({ ...input, id: uuidv4() })
        .select()
        .single();
    if(error) throw error;
    revalidatePath('/admin/expense-categories');
    revalidatePath('/admin/expenses');
    return { ok: true, message: 'Expense category created successfully.', category: data };
  } catch(e: any) {
    return { ok: false, message: `Failed to create category: ${e.message}`};
  }
}

export async function updateExpenseCategoryAction(
  id: string,
  input: Partial<ExpenseCategoryInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('expense_categories')
            .update({ name: input.name, description: input.description })
            .eq('id', id)
            .eq('school_id', input.school_id)
            .select()
            .single();
        if(error) throw error;
        revalidatePath('/admin/expense-categories');
        revalidatePath('/admin/expenses');
        return { ok: true, message: 'Expense category updated.', category: data };
    } catch(e: any) {
        return { ok: false, message: `Failed to update category: ${e.message}`};
    }
}

export async function deleteExpenseCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('expenses').select('id', {count: 'exact', head: true}).eq('category_id', id);
    if(count && count > 0) return { ok: false, message: `Cannot delete: this category is used in ${count} expense record(s).`};

    const { error } = await supabase.from('expense_categories').delete().eq('id', id).eq('school_id', schoolId);
    if(error) throw error;
    revalidatePath('/admin/expense-categories');
    revalidatePath('/admin/expenses');
    return { ok: true, message: 'Expense category deleted.' };
  } catch(e: any) {
    return { ok: false, message: `Failed to delete category: ${e.message}`};
  }
}
