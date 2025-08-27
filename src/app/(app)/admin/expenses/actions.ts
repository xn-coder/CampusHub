
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Expense, ExpenseCategory, User, SchoolDetails } from '@/types';
import { format } from 'date-fns';

interface ExpenseInput {
  title: string;
  amount: number;
  category_id: string;
  date: string;
  receipt_url?: string | null;
  notes?: string | null;
  school_id: string;
  recorded_by_user_id: string;
}

export async function createExpenseAction(
  input: ExpenseInput
): Promise<{ ok: boolean; message: string; expense?: Expense }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input, id: uuidv4() })
      .select()
      .single();
    if (error) throw error;
    
    revalidatePath('/admin/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Expense created successfully.', expense: data };
  } catch(e: any) {
    console.error("Error creating expense:", e);
    return { ok: false, message: `Failed to create expense: ${e.message}` };
  }
}

export async function getExpensesPageDataAction(schoolId: string): Promise<{
    ok: boolean;
    expenses?: Expense[];
    categories?: ExpenseCategory[];
    message?: string;
}> {
    if (!schoolId) {
        return { ok: false, message: "School ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const [expensesRes, categoriesRes] = await Promise.all([
            supabase.from('expenses').select('*, category:category_id(name), recorded_by:recorded_by_user_id(name)').eq('school_id', schoolId).order('date', { ascending: false }),
            supabase.from('expense_categories').select('*').eq('school_id', schoolId).order('name')
        ]);
        
        if (expensesRes.error) throw new Error(`Failed to fetch expenses: ${expensesRes.error.message}`);
        if (categoriesRes.error) throw new Error(`Failed to fetch expense categories: ${categoriesRes.error.message}`);

        return {
            ok: true,
            expenses: expensesRes.data || [],
            categories: categoriesRes.data || [],
        };
    } catch (e: any) {
        console.error("Error fetching expense page data:", e);
        return { ok: false, message: `An unexpected error occurred: ${e.message}` };
    }
}


export async function updateExpenseAction(
  id: string,
  input: Partial<ExpenseInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; expense?: Expense }> {
  const supabase = createSupabaseServerClient();
  try {
    const { school_id, ...updateData } = input;
    const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .eq('school_id', school_id)
        .select()
        .single();
    if (error) throw error;
    
    revalidatePath('/admin/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Expense updated successfully.', expense: data };
  } catch(e: any) {
    console.error("Error updating expense:", e);
    return { ok: false, message: `Failed to update expense: ${e.message}` };
  }
}


export async function deleteExpenseAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('school_id', schoolId);
      if (error) throw error;
      
      revalidatePath('/admin/expenses');
      revalidatePath('/dashboard');
      return { ok: true, message: 'Expense deleted successfully.' };
  } catch (e: any) {
      console.error("Error deleting expense:", e);
      return { ok: false, message: `Failed to delete expense: ${e.message}` };
  }
}


export async function getExpenseVoucherDataAction(expenseId: string): Promise<{
  ok: boolean;
  expense?: Expense;
  school?: SchoolDetails;
  message?: string;
}> {
  const supabase = createSupabaseServerClient();
  try {
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .select('*, category:category_id(name)')
        .eq('id', expenseId)
        .single();
      
      if (expenseError || !expense) {
        return { ok: false, message: expenseError?.message || "Expense record not found." };
      }
      
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', expense.school_id)
        .single();
        
      if(schoolError || !school) {
        return { ok: false, message: schoolError?.message || "School details not found." };
      }

      return {
        ok: true,
        expense: expense,
        school: school,
      };
  } catch(e: any) {
    return { ok: false, message: `An unexpected error occurred: ${e.message}` };
  }
}
