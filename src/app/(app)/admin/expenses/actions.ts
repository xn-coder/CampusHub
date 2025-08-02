
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Expense, ExpenseCategory, User, SchoolDetails } from '@/types';

// Action to create a signed URL for secure, direct-to-storage uploads
export async function createReceiptUploadUrlAction(
    schoolId: string,
    fileName: string,
): Promise<{ ok: boolean; message: string; signedUrl?: string; publicUrl?: string; }> {
    const supabase = createSupabaseServerClient();
    try {
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `public/expense-receipts/${schoolId}/${uuidv4()}-${sanitizedFileName}`;

        const { data, error } = await supabase.storage
            .from('campushub')
            .createSignedUploadUrl(filePath);

        if (error) {
            throw new Error(`Failed to create signed URL: ${error.message}`);
        }
        
        const { data: publicUrlData } = supabase.storage
            .from('campushub')
            .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
            throw new Error("Could not determine public URL for the file path.");
        }

        return {
            ok: true,
            message: "Signed URL created successfully.",
            signedUrl: data.signedUrl,
            publicUrl: publicUrlData.publicUrl,
        };
    } catch (e: any) {
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}

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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { error, data } = await supabaseAdmin
      .from('expenses')
      .insert({ ...input, id: uuidv4() })
      .select()
      .single();

    if (error) {
      if(error.message.includes('relation "public.expenses" does not exist')) {
        console.warn("Create failed: Expenses table not found. Please run the required SQL migration.");
        return { ok: false, message: 'Database setup incomplete.' };
      }
      throw error;
    }
    revalidatePath('/admin/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Expense created successfully.', expense: data as Expense };
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
    const supabaseAdmin = createSupabaseServerClient();
    try {
        const [expensesRes, categoriesRes] = await Promise.all([
            supabaseAdmin.from('expenses').select('*, category:category_id(name), recorded_by:recorded_by_user_id(name)').eq('school_id', schoolId).order('date', { ascending: false }),
            supabaseAdmin.from('expense_categories').select('*').eq('school_id', schoolId).order('name'),
        ]);

        let expensesData: Expense[] = [];
        if (expensesRes.error) {
            if (expensesRes.error.message.includes('relation "public.expenses" does not exist')) {
                console.warn("Expenses table does not exist. Returning empty array.");
            } else {
                throw new Error(`Fetching expenses failed: ${expensesRes.error.message}`);
            }
        } else {
            expensesData = expensesRes.data as Expense[];
        }

        let categoriesData: ExpenseCategory[] = [];
        if (categoriesRes.error) {
             if (categoriesRes.error.message.includes('relation "public.expense_categories" does not exist')) {
                console.warn("Expense Categories table does not exist. Returning empty array.");
            } else {
                throw new Error(`Fetching expense categories failed: ${categoriesRes.error.message}`);
            }
        } else {
            categoriesData = categoriesRes.data || [];
        }


        return {
            ok: true,
            expenses: expensesData,
            categories: categoriesData,
        };
    } catch (error: any) {
        console.error("Error in getExpensesPageDataAction:", error);
        return { ok: false, message: error.message || "An unexpected error occurred." };
    }
}


export async function updateExpenseAction(
  id: string,
  input: Partial<ExpenseInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; expense?: Expense }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  try {
    const { error, data } = await supabaseAdmin
      .from('expenses')
      .update(input)
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select()
      .single();

    if (error) {
       if(error.message.includes('relation "public.expenses" does not exist')) {
        console.warn("Update failed: Expenses table not found.");
        return { ok: false, message: 'Database setup incomplete.' };
      }
      throw error;
    }

    revalidatePath('/admin/expenses');
    revalidatePath('/dashboard');
    return { ok: true, message: 'Expense updated successfully.', expense: data as Expense };
  } catch (e: any) {
    console.error("Error updating expense:", e);
    return { ok: false, message: `Failed to update expense: ${e.message}` };
  }
}


export async function deleteExpenseAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { data: expenseToDelete, error: fetchError } = await supabaseAdmin
      .from('expenses')
      .select('receipt_url')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      if (fetchError.message.includes('relation "public.expenses" does not exist')) {
        console.warn("Delete skipped: Expense record not found (table might not exist).");
        return { ok: true, message: "Expense record already deleted (table does not exist)." };
      }
      throw fetchError;
    }
    
    if (expenseToDelete?.receipt_url && expenseToDelete.receipt_url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
        const filePath = new URL(expenseToDelete.receipt_url).pathname.replace(`/storage/v1/object/public/campushub/`, '');
        const { error: storageError } = await supabaseAdmin.storage.from('campushub').remove([filePath.replace('/public/','')]);
        if (storageError) {
            console.warn(`Failed to delete receipt from storage, but proceeding with DB deletion. Path: ${filePath}, Error: ${storageError.message}`);
        }
    }

    const { error } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) {
      if(error.message.includes('relation "public.expenses" does not exist')) {
        console.warn("Delete skipped: Expense record not found (table does not exist).");
        return { ok: true, message: "Expense record already deleted (table does not exist)." };
      }
      throw error;
    }

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
  if (!expenseId) {
    return { ok: false, message: "Expense ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('*, category:category_id(name)')
      .eq('id', expenseId)
      .single();
      
    if (expenseError) throw new Error(`Fetching expense failed: ${expenseError.message}`);
    if (!expense) throw new Error("Expense record not found.");
    
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', expense.school_id)
      .single();

    if (schoolError) throw new Error(`Fetching school details failed: ${schoolError.message}`);
    
    return {
      ok: true,
      expense: expense as Expense,
      school: school as SchoolDetails,
    };
  } catch (error: any) {
    console.error("Error in getExpenseVoucherDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
