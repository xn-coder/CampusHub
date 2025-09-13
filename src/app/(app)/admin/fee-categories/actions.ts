
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeCategory } from '@/types';

export async function getFeeCategoriesAction(schoolId: string): Promise<{ ok: boolean; message?: string; categories?: FeeCategory[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
        .from('fee_categories')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
    if (error) throw error;
    return { ok: true, categories: data || [] };
  } catch(e: any) {
    console.error("Error fetching fee categories:", e);
    if(e.message.includes('relation "public.fee_categories" does not exist')) {
        return { ok: true, categories: [], message: "Fee Categories table not set up."};
    }
    return { ok: false, message: e.message || "An unexpected error occurred."};
  }
}


export async function createFeeCategoryAction(
  input: { name: string; description?: string; school_id: string; }
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data: existing } = await supabase.from('fee_categories').select('id').eq('name', input.name).eq('school_id', input.school_id).maybeSingle();
    if(existing) return { ok: false, message: `A fee category named "${input.name}" already exists.`};

    const { data, error } = await supabase
        .from('fee_categories')
        .insert({ ...input, id: uuidv4() })
        .select()
        .single();
    if(error) throw error;
    revalidatePath('/admin/fee-categories');
    return { ok: true, message: 'Fee category created successfully.', category: data };
  } catch(e: any) {
    return { ok: false, message: `Failed to create category: ${e.message}`};
  }
}

export async function updateFeeCategoryAction(
  id: string,
  input: Partial<{ name: string; description?: string; }>
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('fee_categories')
            .update(input)
            .eq('id', id)
            .select()
            .single();
        if(error) throw error;
        revalidatePath('/admin/fee-categories');
        return { ok: true, message: 'Fee category updated.', category: data };
    } catch(e: any) {
        return { ok: false, message: `Failed to update category: ${e.message}`};
    }
}

export async function deleteFeeCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('student_fee_payments').select('id', {count: 'exact', head: true}).eq('fee_category_id', id);
    if(count && count > 0) return { ok: false, message: `Cannot delete: this category is used in ${count} fee record(s).`};

    const { error } = await supabase.from('fee_categories').delete().eq('id', id).eq('school_id', schoolId);
    if(error) throw error;
    revalidatePath('/admin/fee-categories');
    return { ok: true, message: 'Fee category deleted.' };
  } catch(e: any) {
    return { ok: false, message: `Failed to delete category: ${e.message}`};
  }
}
