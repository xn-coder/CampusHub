

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentFeePayment, PaymentStatus, Student, FeeCategory, AcademicYear, ClassData } from '@/types';
import { isPast, startOfDay } from 'date-fns';
import Razorpay from 'razorpay';
import crypto from 'crypto';


interface AssignFeeInput {
  student_id: string;
  fee_category_id: string;
  assigned_amount: number;
  due_date?: string;
  notes?: string;
  academic_year_id?: string;
  school_id: string;
}

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

export async function fetchStudentFeesPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  feePayments?: StudentFeePayment[];
  students?: Student[];
  feeCategories?: FeeCategory[];
  academicYears?: AcademicYear[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [paymentsRes, studentsRes, categoriesRes, academicYearsRes, classesRes] = await Promise.all([
      supabaseAdmin.from('student_fee_payments').select('*').eq('school_id', schoolId).order('due_date', { ascending: false, nullsFirst: false }),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('fee_categories').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name')
    ]);

    if (paymentsRes.error) throw new Error(`Fetching fee payments failed: ${paymentsRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (categoriesRes.error) throw new Error(`Fetching fee categories failed: ${categoriesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);

    return {
      ok: true,
      feePayments: paymentsRes.data || [],
      students: studentsRes.data || [],
      feeCategories: categoriesRes.data || [],
      academicYears: academicYearsRes.data || [],
      classes: classesRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in fetchStudentFeesPageDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
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
      status: 'Pending' as PaymentStatus,
    })
    .select()
    .single();

  if (error) {
    console.error("Error assigning student fee:", error);
    return { ok: false, message: `Failed to assign fee: ${error.message}` };
  }
  revalidatePath('/admin/student-fees');
  revalidatePath('/student/payment-history');
  return { ok: true, message: 'Fee assigned successfully.', feePayment: data as StudentFeePayment };
}

interface AssignMultipleFeesToClassInput {
  class_id: string;
  fee_category_ids: string[];
  due_date?: string;
  notes?: string;
  academic_year_id?: string | null;
  school_id: string;
}

export async function assignMultipleFeesToClassAction(
  input: AssignMultipleFeesToClassInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const supabaseAdmin = createSupabaseServerClient();
    const { class_id, fee_category_ids, school_id, ...restOfInput } = input;

    if (!fee_category_ids || fee_category_ids.length === 0) {
        return { ok: false, message: "No fee categories selected.", assignmentsCreated: 0 };
    }

    const { data: students, error: studentsError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('class_id', class_id)
        .eq('school_id', school_id);
    
    if (studentsError) {
        return { ok: false, message: `Failed to fetch students in the class: ${studentsError.message}`, assignmentsCreated: 0 };
    }

    if (!students || students.length === 0) {
        return { ok: false, message: "No students found in the selected class.", assignmentsCreated: 0 };
    }
    const studentIds = students.map(s => s.id);

    const { data: categoriesData, error: categoriesError } = await supabaseAdmin
        .from('fee_categories')
        .select('id, amount')
        .in('id', fee_category_ids)
        .eq('school_id', school_id);
    
    if (categoriesError) {
        return { ok: false, message: `Failed to fetch fee category details: ${categoriesError.message}`, assignmentsCreated: 0 };
    }

    const { data: existingAssignments, error: existingCheckError } = await supabaseAdmin
        .from('student_fee_payments')
        .select('student_id, fee_category_id')
        .in('student_id', studentIds)
        .in('fee_category_id', fee_category_ids)
        .eq('school_id', school_id);

    if (existingCheckError) {
        return { ok: false, message: `DB error checking existing assignments: ${existingCheckError.message}`, assignmentsCreated: 0 };
    }

    const existingSet = new Set((existingAssignments || []).map(a => `${a.student_id}-${a.fee_category_id}`));
    
    const feeAssignments = [];
    for (const student of students) {
        for (const category of categoriesData || []) {
            const assignmentKey = `${student.id}-${category.id}`;
            if (!existingSet.has(assignmentKey)) {
                feeAssignments.push({
                    id: uuidv4(),
                    student_id: student.id,
                    fee_category_id: category.id,
                    assigned_amount: category.amount || 0,
                    due_date: restOfInput.due_date,
                    notes: restOfInput.notes,
                    academic_year_id: restOfInput.academic_year_id,
                    school_id: school_id,
                    paid_amount: 0,
                    status: 'Pending' as PaymentStatus,
                });
            }
        }
    }
    
    if (feeAssignments.length === 0) {
        return { ok: true, message: "No new fees to assign. All selected fees may already be assigned to these students.", assignmentsCreated: 0 };
    }

    const { error: insertError, count } = await supabaseAdmin
        .from('student_fee_payments')
        .insert(feeAssignments);

    if (insertError) {
        return { ok: false, message: `Failed to assign fees: ${insertError.message}`, assignmentsCreated: 0 };
    }

    revalidatePath('/admin/student-fees');
    revalidatePath('/student/payment-history');

    return { ok: true, message: `Successfully assigned ${feeAssignments.length} new fee records to ${students.length} students.`, assignmentsCreated: count || 0 };
}


interface RecordPaymentInput {
  fee_payment_id: string;
  payment_amount: number;
  payment_date: string;
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

  const { error, data } = await supabaseAdmin
    .from('student_fee_payments')
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
      payment_date: payment_date,
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

export async function deleteStudentFeeAssignmentAction(
  feePaymentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
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
  revalidatePath('/student/payment-history');
  return { ok: true, message: 'Fee assignment deleted successfully.' };
}


export async function getStudentPaymentHistoryAction(
  studentId: string, // This should be students.id (student_profile_id)
  schoolId: string
): Promise<{ ok: boolean; message?: string; payments?: StudentFeePayment[], feeCategories?: FeeCategory[] }> {
  if (!studentId || !schoolId) {
    return { ok: false, message: "Student ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const [paymentsRes, categoriesRes] = await Promise.all([
        supabase
        .from('student_fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false, nullsFirst: true })
        .order('due_date', { ascending: false, nullsFirst: true }),
        supabase.from('fee_categories').select('*').eq('school_id', schoolId)
    ]);


    if (paymentsRes.error) {
      console.error("Error fetching student payment history:", paymentsRes.error);
      return { ok: false, message: `Database error: ${paymentsRes.error.message}` };
    }
    if (categoriesRes.error) {
        console.error("Error fetching fee categories for payment history:", categoriesRes.error);
        // Non-fatal, but categories won't be named
    }

    return { ok: true, payments: paymentsRes.data || [], feeCategories: categoriesRes.data || [] };
  } catch (e: any) {
    console.error("Unexpected error fetching student payment history:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function mockPayFeesAction(
  studentProfileId: string,
  schoolId: string,
  feePaymentIds: string[]
): Promise<{ ok: boolean; message: string; paidCount: number }> {
  const supabaseAdmin = createSupabaseServerClient();

  if (!feePaymentIds || feePaymentIds.length === 0) {
    return { ok: false, message: "No fee records specified for payment.", paidCount: 0 };
  }

  const { data: feesToPay, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('id, assigned_amount')
    .in('id', feePaymentIds)
    .eq('student_id', studentProfileId)
    .eq('school_id', schoolId);

  if (fetchError) {
    console.error("Error fetching fees for mock payment:", fetchError);
    return { ok: false, message: "Could not retrieve fee records to process payment.", paidCount: 0 };
  }

  if (!feesToPay || feesToPay.length === 0) {
    return { ok: true, message: "Selected fees were not found or are already paid.", paidCount: 0 };
  }

  let paidCount = 0;
  const errors = [];
  
  for (const fee of feesToPay) {
    const { error: updateError } = await supabaseAdmin
      .from('student_fee_payments')
      .update({
        paid_amount: fee.assigned_amount,
        status: 'Paid' as PaymentStatus,
        payment_date: new Date().toISOString(),
      })
      .eq('id', fee.id);
    
    if (updateError) {
      errors.push(updateError.message);
      console.error(`Failed to update fee ID ${fee.id}:`, updateError);
    } else {
      paidCount++;
    }
  }

  if (errors.length > 0) {
    return { 
      ok: false, 
      message: `Successfully paid ${paidCount} fees, but failed to update ${errors.length} fee records. Please contact support.`,
      paidCount
    };
  }
  
  revalidatePath('/student/payment-history');
  revalidatePath('/admin/student-fees');
  revalidatePath('/dashboard');

  return { ok: true, message: `Mock payment successful! ${paidCount} fee record(s) have been updated.`, paidCount };
}


interface UpdateStudentFeeInput {
  assigned_amount?: number;
  due_date?: string;
  notes?: string;
}

export async function updateStudentFeeAction(
  id: string,
  schoolId: string,
  updates: UpdateStudentFeeInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  if (!id || !schoolId) {
    return { ok: false, message: "Fee Payment ID and School ID are required." };
  }
  
  const { error } = await supabaseAdmin
    .from('student_fee_payments')
    .update(updates)
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error updating student fee assignment:", error);
    return { ok: false, message: `Failed to update fee assignment: ${error.message}` };
  }

  revalidatePath('/admin/student-fees');
  revalidatePath('/student/payment-history');
  return { ok: true, message: 'Fee assignment updated successfully.' };
}

export async function getStudentPendingFeeCountAction(
  studentProfileId: string,
  schoolId: string
): Promise<{ ok: boolean; count: number; message?: string }> {
  if (!studentProfileId || !schoolId) {
    return { ok: false, count: 0, message: "Student and School IDs are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { count, error } = await supabase
      .from('student_fee_payments')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentProfileId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue']);

    if (error) {
      console.error("Error fetching pending fee count:", error);
      return { ok: false, count: 0, message: `Database error: ${error.message}` };
    }
    return { ok: true, count: count || 0 };
  } catch (e: any) {
    console.error("Unexpected error fetching pending fee count:", e);
    return { ok: false, count: 0, message: `Unexpected error: ${e.message}` };
  }
}

export async function checkStudentFeeStatusAction(
  studentProfileId: string,
  schoolId: string
): Promise<{ ok: boolean; isDefaulter: boolean; message: string }> {
  if (!studentProfileId || !schoolId) {
    return { ok: false, isDefaulter: false, message: "Student and School IDs are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    // A student is a defaulter if they have any fee that is not 'Paid' AND its due_date is in the past.
    const { data: overdueFees, error } = await supabase
      .from('student_fee_payments')
      .select('id, due_date')
      .eq('student_id', studentProfileId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue'])
      .lt('due_date', new Date().toISOString()) // Check if due date is less than today
      .limit(1); // We only need to know if at least one exists

    if (error) {
      console.error("Error fetching student fee status:", error);
      return { ok: false, isDefaulter: false, message: `Database error: ${error.message}` };
    }

    const isDefaulter = (overdueFees || []).length > 0;

    const message = isDefaulter
      ? "You have overdue fees. Please clear your dues to access all features."
      : "Fee status is clear.";

    return { ok: true, isDefaulter, message };

  } catch (e: any) {
    console.error("Unexpected error checking fee status:", e);
    return { ok: false, isDefaulter: false, message: `Unexpected error: ${e.message}` };
  }
}

// --- Razorpay Actions ---
let razorpayInstance: Razorpay | null = null;
if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} else {
    console.warn("Razorpay credentials not found in .env. Payment gateway will not function.");
}

export async function createRazorpayOrderAction(
  amountInPaisa: number,
  feePaymentIds: string[],
  studentProfileId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string; order?: any, isMock?: boolean }> {
  const isRazorpayEnabled = process.env.RAZORPAY_ENABLED === 'true';

  if (!isRazorpayEnabled) {
      console.log("Razorpay is disabled. Simulating successful payment for student fees.");
      const mockResult = await mockPayFeesAction(studentProfileId, schoolId, feePaymentIds);
      if (mockResult.ok) {
        return { ok: true, isMock: true, message: mockResult.message };
      } else {
        return { ok: false, isMock: true, message: mockResult.message };
      }
  }

  if (!razorpayInstance) {
    return { ok: false, message: "Razorpay is not configured on the server." };
  }
  if (amountInPaisa <= 0) {
    return { ok: false, message: "Payment amount must be positive." };
  }
  if (feePaymentIds.length === 0) {
    return { ok: false, message: "At least one fee record must be selected for payment." };
  }

  const options = {
    amount: amountInPaisa,
    currency: "INR",
    receipt: `rcpt_${uuidv4().substring(0, 15)}`,
    notes: {
      fee_payment_ids: JSON.stringify(feePaymentIds), // Store fee IDs in notes
    },
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return { ok: true, message: "Order created successfully.", order };
  } catch (error: any) {
    console.error("Razorpay order creation error:", JSON.stringify(error, null, 2));
    const errorMessage = error?.error?.description || error?.message || "An unknown error occurred.";
    return { ok: false, message: `Failed to create Razorpay order: ${errorMessage}` };
  }
}

export async function verifyRazorpayPaymentAction(
  razorpay_payment_id: string,
  razorpay_order_id: string,
  razorpay_signature: string,
  schoolId: string
): Promise<{ ok: boolean, message: string }> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return { ok: false, message: "Razorpay secret key is not configured on the server." };
  }

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return { ok: false, message: "Payment verification failed: Invalid signature." };
  }

  // Signature is valid, now fetch the order to get the fee IDs and amount.
  if (!razorpayInstance) {
    return { ok: false, message: "Razorpay is not configured on the server." };
  }
  
  try {
    const orderDetails = await razorpayInstance.orders.fetch(razorpay_order_id);
    const paidAmount = orderDetails.amount_paid / 100; // Convert from paisa to rupees
    const feePaymentIds: string[] = JSON.parse(orderDetails.notes?.fee_payment_ids || '[]');
    
    if (feePaymentIds.length === 0) {
      return { ok: false, message: "No fee records found in the payment order." };
    }
    
    // For simplicity, we assume the full due amount for the selected fees was paid.
    // A more complex system might distribute the paidAmount across the fees.
    for (const feeId of feePaymentIds) {
      await recordStudentFeePaymentAction({
        fee_payment_id: feeId,
        payment_amount: paidAmount / feePaymentIds.length, // Distribute payment equally for this simple case
        payment_date: new Date().toISOString(),
        school_id: schoolId
      });
    }

    revalidatePath('/student/payment-history');
    return { ok: true, message: "Payment verified and recorded successfully!" };
  } catch (error: any) {
    console.error("Error during payment verification process:", error);
    return { ok: false, message: `Payment recorded but verification step failed: ${error.message}` };
  }
}
