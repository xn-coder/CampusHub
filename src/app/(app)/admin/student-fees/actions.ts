
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentFeePayment, PaymentStatus } from '@/types';

interface AssignFeeInput {
  student_id: string;
  fee_category_id: string;
  assigned_amount: number;
  due_date?: string; // YYYY-MM-DD
  notes?: string;
  academic_year_id?: string;
  school_id: string;
}

export async function assignStudentFeeAction(
  input: AssignFeeInput
): Promise<{ ok: boolean; message: string; feePayment?: StudentFeePayment }> {
  const supabaseAdmin = createSupabaseServerClient();
  const feePaymentId = uuidv4();

  const { error, data } = await supabaseAdmin
    .from('student_fee_payments')
    .insert({
      ...input,
      id: feePaymentId,
      paid_amount: 0,
      status: 'Pending' as PaymentStatus, // Initial status
    })
    .select()
    .single();

  if (error) {
    console.error("Error assigning student fee:", error);
    return { ok: false, message: `Failed to assign fee: ${error.message}` };
  }
  revalidatePath('/admin/student-fees');
  return { ok: true, message: 'Fee assigned successfully.', feePayment: data as StudentFeePayment };
}

interface RecordPaymentInput {
  fee_payment_id: string;
  payment_amount: number;
  payment_date: string; // YYYY-MM-DD
  school_id: string;
}

export async function recordStudentFeePaymentAction(
  input: RecordPaymentInput
): Promise<{ ok: boolean; message: string; feePayment?: StudentFeePayment }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { fee_payment_id, payment_amount, payment_date, school_id } = input;

  const { data: existingFeePayment, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('assigned_amount, paid_amount')
    .eq('id', fee_payment_id)
    .eq('school_id', school_id)
    .single();

  if (fetchError || !existingFeePayment) {
    console.error("Error fetching existing fee payment or not found:", fetchError);
    return { ok: false, message: 'Fee assignment not found or database error.' };
  }

  const newPaidAmount = existingFeePayment.paid_amount + payment_amount;
  let newStatus: PaymentStatus = 'Pending';

  if (newPaidAmount >= existingFeePayment.assigned_amount) {
    newStatus = 'Paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'Partially Paid';
  }
  // Note: 'Overdue' status would typically be determined by comparing due_date with current date,
  // which might be better handled by a scheduled task or view logic, not directly here on payment.

  const { error, data } = await supabaseAdmin
    .from('student_fee_payments')
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
      payment_date: payment_date, // Update with the date of this specific payment
    })
    .eq('id', fee_payment_id)
    .eq('school_id', school_id)
    .select()
    .single();

  if (error) {
    console.error("Error recording student fee payment:", error);
    return { ok: false, message: `Failed to record payment: ${error.message}` };
  }
  revalidatePath('/admin/student-fees');
  return { ok: true, message: 'Payment recorded successfully.', feePayment: data as StudentFeePayment };
}


export async function deleteStudentFeeAssignmentAction(
  feePaymentId: string, 
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // Optionally, add a check here: if fee_payment.paid_amount > 0, prevent deletion or require special handling.
  const { data: feePayment, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('paid_amount')
    .eq('id', feePaymentId)
    .eq('school_id', schoolId)
    .single();

  if (fetchError) {
    console.error("Error fetching fee assignment for deletion check:", fetchError);
    return { ok: false, message: `Error checking fee assignment: ${fetchError.message}` };
  }
  if (feePayment && feePayment.paid_amount > 0) {
    return { ok: false, message: "Cannot delete: This fee assignment has payments recorded. Consider refunding or voiding first." };
  }


  const { error } = await supabaseAdmin
    .from('student_fee_payments')
    .delete()
    .eq('id', feePaymentId)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting student fee assignment:", error);
    return { ok: false, message: `Failed to delete fee assignment: ${error.message}` };
  }
  revalidatePath('/admin/student-fees');
  return { ok: true, message: 'Fee assignment deleted successfully.' };
}

    