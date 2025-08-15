
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { SchoolDetails } from '@/types';

export interface ReceiptItemInput {
  ledger: string;
  description?: string;
  amount: number;
}

export interface ReceiptInput {
  narration?: string;
  payment_date: string; // YYYY-MM-DD
  payment_mode: string;
  items: ReceiptItemInput[];
  school_id: string;
  created_by_user_id: string;
}

export interface ReceiptDB extends Omit<ReceiptInput, 'items'> {
    id: string;
    receipt_no: number;
    total_amount: number;
    created_at: string;
}

export interface ReceiptItemDB extends ReceiptItemInput {
    id: string;
    receipt_id: string;
    school_id: string;
}


export async function createReceiptAction(
  input: ReceiptInput
): Promise<{ ok: boolean; message: string; receipt?: ReceiptDB }> {
  const supabase = createSupabaseServerClient();
  const { narration, payment_date, payment_mode, items, school_id, created_by_user_id } = input;

  if (!items || items.length === 0) {
    return { ok: false, message: 'At least one ledger item is required.' };
  }

  const totalAmount = items.reduce((acc, item) => acc + item.amount, 0);
  const receiptId = uuidv4();

  try {
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        id: receiptId,
        narration,
        payment_date,
        payment_mode,
        total_amount: totalAmount,
        school_id,
        created_by_user_id,
      })
      .select()
      .single();

    if (receiptError) throw receiptError;
    if (!receiptData) throw new Error('Failed to create receipt header.');

    const itemsToInsert = items.map(item => ({
      ...item,
      id: uuidv4(),
      receipt_id: receiptId,
      school_id: school_id,
    }));

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback receipt creation if items fail
      await supabase.from('receipts').delete().eq('id', receiptId);
      throw itemsError;
    }

    revalidatePath('/admin/receipts');
    return { ok: true, message: 'Receipt created successfully.', receipt: receiptData as ReceiptDB };
  } catch (e: any) {
    console.error('Error creating receipt:', e);
    return { ok: false, message: `Failed to create receipt: ${e.message}` };
  }
}

export async function getReceiptsAction(schoolId: string): Promise<{
    ok: boolean;
    receipts?: ReceiptDB[];
    items?: ReceiptItemDB[];
    message?: string;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const [receiptsRes, itemsRes] = await Promise.all([
            supabase.from('receipts').select('*').eq('school_id', schoolId).order('receipt_no', { ascending: false }),
            supabase.from('receipt_items').select('*').eq('school_id', schoolId)
        ]);

        if(receiptsRes.error) throw new Error(`Failed to fetch receipts: ${receiptsRes.error.message}`);
        if(itemsRes.error) throw new Error(`Failed to fetch receipt items: ${itemsRes.error.message}`);
        
        return { 
            ok: true, 
            receipts: receiptsRes.data as ReceiptDB[], 
            items: itemsRes.data as ReceiptItemDB[] 
        };

    } catch(e: any) {
        console.error("Error fetching receipts data:", e);
        return { ok: false, message: e.message || 'An unexpected error occurred.' };
    }
}

export async function getVoucherDataAction(receiptId: string): Promise<{
    ok: boolean;
    receipt?: ReceiptDB;
    items?: ReceiptItemDB[];
    school?: SchoolDetails | null;
    message?: string;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: receipt, error: receiptError } = await supabase
            .from('receipts')
            .select('*')
            .eq('id', receiptId)
            .single();
        if (receiptError || !receipt) throw new Error(receiptError?.message || 'Receipt not found.');

        const { data: items, error: itemsError } = await supabase
            .from('receipt_items')
            .select('*')
            .eq('receipt_id', receiptId);
        if (itemsError) throw new Error(itemsError.message);
        
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('*')
            .eq('id', receipt.school_id)
            .single();
        if (schoolError) throw new Error(schoolError.message);

        return {
            ok: true,
            receipt: receipt as ReceiptDB,
            items: items as ReceiptItemDB[],
            school: school as SchoolDetails
        };
    } catch(e: any) {
        console.error('Error fetching voucher data:', e);
        return { ok: false, message: e.message };
    }
}
