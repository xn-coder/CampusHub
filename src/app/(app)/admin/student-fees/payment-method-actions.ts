
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export interface PaymentMethod {
  id: string;
  school_id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getPaymentMethodsAction(schoolId: string): Promise<{ ok: boolean; methods?: PaymentMethod[]; message?: string }> {
    if (!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('school_id', schoolId)
            .order('name');
        if (error) throw error;
        return { ok: true, methods: data || [] };
    } catch (e: any) {
        return { ok: false, message: `DB Error: ${e.message}` };
    }
}

export async function createPaymentMethodAction(input: Pick<PaymentMethod, 'name' | 'description' | 'school_id'>): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    try {
        const { error } = await supabase.from('payment_methods').insert(input);
        if (error) throw error;
        revalidatePath('/admin/student-fees');
        return { ok: true, message: 'Payment method added.' };
    } catch (e: any) {
        return { ok: false, message: `Failed to create method: ${e.message}` };
    }
}

export async function updatePaymentMethodAction(id: string, updates: Partial<Pick<PaymentMethod, 'name' | 'description'>>, schoolId: string): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    try {
        const { error } = await supabase.from('payment_methods').update(updates).eq('id', id).eq('school_id', schoolId);
        if (error) throw error;
        revalidatePath('/admin/student-fees');
        return { ok: true, message: 'Payment method updated.' };
    } catch (e: any) {
        return { ok: false, message: `Failed to update method: ${e.message}` };
    }
}

export async function deletePaymentMethodAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    try {
        // Here you might add a check to see if the method is in use in `student_fee_payments`
        const { error } = await supabase.from('payment_methods').delete().eq('id', id).eq('school_id', schoolId);
        if (error) throw error;
        revalidatePath('/admin/student-fees');
        return { ok: true, message: 'Payment method deleted.' };
    } catch (e: any) {
        return { ok: false, message: `Failed to delete method: ${e.message}` };
    }
}
