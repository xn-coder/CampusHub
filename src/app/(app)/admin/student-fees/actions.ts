
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentFeePayment, PaymentStatus, Student, FeeCategory, AcademicYear, ClassData, Installment, Concession } from '@/types';
import Razorpay from 'razorpay';
import crypto from 'crypto';


export async function fetchAdminSchoolIdForFees(userId: string): Promise<string | null> {
  if (!userId) {
    console.error("fetchAdminSchoolIdForFees: User ID is required.");
    return null;
  }
  const supabase = createSupabaseServerClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .single();

  if (error || !user?.school_id) {
    console.error("Error fetching user's school for fees:", error?.message);
    return null;
  }
  return user.school_id;
}


export async function getStudentsByClass(schoolId: string, classId: string): Promise<{ ok: boolean; students?: Student[]; message?: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('*') // Select all fields needed for display in the student dropdown
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('name');

  if (error) {
    console.error(`Error fetching students for class ${classId}:`, error);
    return { ok: false, message: error.message };
  }

  return { ok: true, students: data || [] };
}


interface RecordPaymentInput {
  fee_payment_id: string;
  payment_amount: number;
  payment_date: string;
  school_id: string;
  payment_mode?: string;
  notes?: string;
}

export async function recordStudentFeePaymentAction(
  input: RecordPaymentInput
): Promise<{ ok: boolean; message: string; feePayment?: StudentFeePayment }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { fee_payment_id, payment_amount, payment_date, school_id, payment_mode, notes } = input;


  const { data: existingFeePayment, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('assigned_amount, paid_amount, notes')
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

  const finalPaidAmount = Math.min(newPaidAmount, existingFeePayment.assigned_amount);
  
  const updatedNotes = notes ? (existingFeePayment.notes ? `${existingFeePayment.notes}\n${notes}` : notes) : existingFeePayment.notes;

  const { error, data } = await supabaseAdmin
    .from('student_fee_payments')
    .update({
      paid_amount: finalPaidAmount,
      status: newStatus,
      payment_date: payment_date,
      payment_mode: payment_mode || 'Cash',
      notes: updatedNotes,
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
  revalidatePath('/student/payment-history');
  revalidatePath('/dashboard');
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Payment recorded successfully.', feePayment: data as StudentFeePayment };
}

export async function getConcessionsAction(schoolId: string) {
    if (!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from('concessions').select('*').eq('school_id', schoolId);
    if (error) {
       if (error.message.includes('relation "public.concessions" does not exist')) {
            console.warn("Concessions table not found. Feature may not work as expected.");
            return { ok: true, concessions: [] }; // Graceful failure
        }
        return { ok: false, message: `DB Error: ${error.message}` };
    }
    return { ok: true, concessions: data };
}
