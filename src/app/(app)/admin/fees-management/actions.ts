
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

interface ApplyConcessionInput {
  student_id: string;
  fee_payment_id: string;
  concession_id: string;
  amount: number;
  school_id: string;
  applied_by_user_id: string;
}

export async function applyConcessionAction(input: ApplyConcessionInput): Promise<{ ok: boolean; message: string; }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: fee, error: fetchError } = await supabase.from('student_fee_payments').select('assigned_amount, paid_amount').eq('id', input.fee_payment_id).single();
        if (fetchError || !fee) return { ok: false, message: "Fee record not found." };
        if (input.amount > (fee.assigned_amount - fee.paid_amount)) return { ok: false, message: "Concession cannot be greater than the outstanding amount."};

        const { error: concessionError } = await supabase.from('student_fee_concessions').insert({
            id: crypto.randomUUID(),
            student_fee_payment_id: input.fee_payment_id,
            concession_id: input.concession_id,
            student_id: input.student_id,
            school_id: input.school_id,
            concession_amount: input.amount,
            applied_by_user_id: input.applied_by_user_id,
        });
        if (concessionError) throw new Error(`Failed to record concession: ${concessionError.message}`);
        
        const newPaidAmount = fee.paid_amount + input.amount;
        const newStatus = newPaidAmount >= fee.assigned_amount ? 'Paid' : 'Partially Paid';
        
        const { error: updateError } = await supabase.from('student_fee_payments')
            .update({ paid_amount: newPaidAmount, status: newStatus, notes: `Concession applied: ${input.amount}` })
            .eq('id', input.fee_payment_id);
        if (updateError) throw new Error(`Failed to update fee record: ${updateError.message}`);

        revalidatePath('/admin/manage-concessions');
        revalidatePath('/admin/student-fees');
        return { ok: true, message: `Successfully applied concession of ₹${input.amount.toFixed(2)}.` };
    } catch(e: any) {
        console.error("Error applying concession:", e);
        return { ok: false, message: e.message || "Failed to apply concession."};
    }
}

export async function getConcessionsAction(schoolId: string) {
    if (!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from('concessions').select('*').eq('school_id', schoolId);
    if (error) return { ok: false, message: `DB Error: ${error.message}` };
    return { ok: true, concessions: data };
}
