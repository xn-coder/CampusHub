
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentFeePayment, PaymentStatus, Student, FeeCategory, AcademicYear, ClassData, Installment } from '@/types';
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


export async function getAllClasses(schoolId: string): Promise<{ ok: boolean; classes?: ClassData[]; message?: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error("Error fetching classes:", error);
    return { ok: false, message: error.message };
  }
  return { ok: true, classes: data || [] };
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

// Renamed existing fetch to be more specific
// Original: fetchStudentFeesPageDataAction
// New: fetchAdminFeesOverviewDataAction (or similar, but keeping for now)
export async function fetchStudentFeesPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  feePayments?: StudentFeePayment[];
  students?: Student[];
  feeCategories?: FeeCategory[];
  academicYears?: AcademicYear[];
  classes?: ClassData[];
  installments?: Installment[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [paymentsRes, studentsRes, categoriesRes, academicYearsRes, classesRes, installmentsRes] = await Promise.all([
      supabaseAdmin.from('student_fee_payments').select('*').eq('school_id', schoolId).order('due_date', { ascending: false, nullsFirst: false }),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('fee_categories').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('installments').select('*').eq('school_id', schoolId).order('title')
    ]);

    if (paymentsRes.error) throw new Error(`Fetching fee payments failed: ${paymentsRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (categoriesRes.error) throw new Error(`Fetching fee categories failed: ${categoriesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (installmentsRes.error) throw new Error(`Fetching installments failed: ${installmentsRes.error.message}`);

    return {
      ok: true,
      feePayments: paymentsRes.data || [],
      students: studentsRes.data || [],
      feeCategories: categoriesRes.data || [],
      academicYears: academicYearsRes.data || [],
      classes: classesRes.data || [],
      installments: installmentsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in fetchStudentFeesPageDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function getStudentFeeHistory(studentId: string): Promise<{ ok: boolean; payments?: StudentFeePayment[]; message?: string }> {
  const supabase = createSupabaseServerClient();
  // Assuming student_fee_payments table has foreign keys or relationships
  // to fee_categories, academic_years, etc., if needed for joining.
  // For now, fetch directly from student_fee_payments.
  // You might need to adjust the select statement and joins based on your schema.
  const { data, error } = await supabase
    .from('student_fee_payments')
    .select(`
      *,
      fee_categories ( name ),
      academic_years ( year ),
      installments ( title )
    `) // Adjust select based on your schema
    .eq('student_id', studentId)
    .order('due_date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(`Error fetching fee history for student ${studentId}:`, error);
    return { ok: false, message: error.message };
  }

  // Map the joined data into the desired structure if necessary
  const payments = data?.map(p => ({
    ...p,
    fee_category_name: p.fee_categories?.name,
    academic_year_name: p.academic_years?.year,
    installment_title: p.installments?.title,
  })) as StudentFeePayment[] | undefined; // Type assertion might be needed
  return { ok: true, payments: payments || [] };
}

export async function assignStudentFeeAction(
  input: {
      student_id: string;
      fee_category_id: string;
      assigned_amount: number;
      due_date?: string;
      notes?: string;
      academic_year_id?: string;
      school_id: string;
  }
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
  installment_id?: string | null;
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

    let existingCheckQuery = supabaseAdmin
        .from('student_fee_payments')
        .select('student_id, fee_category_id, installment_id')
        .in('student_id', studentIds)
        .in('fee_category_id', fee_category_ids)
        .eq('school_id', school_id);
    
    if (restOfInput.installment_id) {
        existingCheckQuery = existingCheckQuery.eq('installment_id', restOfInput.installment_id);
    } else {
        existingCheckQuery = existingCheckQuery.is('installment_id', null);
    }
    
    if (restOfInput.academic_year_id) {
      existingCheckQuery = existingCheckQuery.eq('academic_year_id', restOfInput.academic_year_id);
    } else {
      existingCheckQuery = existingCheckQuery.is('academic_year_id', null);
    }


    const { data: existingAssignments, error: existingCheckError } = await existingCheckQuery;

    if (existingCheckError) {
        return { ok: false, message: `DB error checking existing assignments: ${existingCheckError.message}`, assignmentsCreated: 0 };
    }

    const existingSet = new Set((existingAssignments || []).map(a => `${a.student_id}-${a.fee_category_id}-${a.installment_id || 'null'}`));
    
    const feeAssignments = [];
    for (const student of students) {
        for (const category of categoriesData || []) {
            const assignmentKey = `${student.id}-${category.id}-${restOfInput.installment_id || 'null'}`;
            if (!existingSet.has(assignmentKey)) {
                feeAssignments.push({
                    id: uuidv4(),
                    student_id: student.id,
                    fee_category_id: category.id,
                    assigned_amount: category.amount || 0,
                    due_date: restOfInput.due_date,
                    notes: restOfInput.notes,
                    academic_year_id: restOfInput.academic_year_id,
                    installment_id: restOfInput.installment_id,
                    school_id: school_id,
                    paid_amount: 0,
                    status: 'Pending' as PaymentStatus,
                });
            }
        }
    }
    
    if (feeAssignments.length === 0) {
        return { ok: true, message: "No new fees to assign. All selected fees may already be assigned to these students for this period.", assignmentsCreated: 0 };
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
  const { fee_payment_id, payment_amount, payment_date, school_id } = input; // payment_amount is the *new* amount being paid


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

  // Calculate the new total paid amount
  const newPaidAmount = existingFeePayment.paid_amount + payment_amount; 
  let newStatus: PaymentStatus = 'Pending';

  if (newPaidAmount >= existingFeePayment.assigned_amount) {
    newStatus = 'Paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'Partially Paid';
  }

  // Ensure the new paid amount does not exceed the assigned amount unless it's a full payment
  const finalPaidAmount = Math.min(newPaidAmount, existingFeePayment.assigned_amount);

  const { error, data } = await supabaseAdmin
    .from('student_fee_payments')
    .update({
      paid_amount: finalPaidAmount,
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


export async function recordPayment(feeId: string, amount: number, notes?: string): Promise<{ ok: boolean; message: string }> {
    const supabaseAdmin = createSupabaseServerClient();

    const { data: feePayment, error: fetchError } = await supabaseAdmin
        .from('student_fee_payments')
        .select('assigned_amount, paid_amount, notes')
        .eq('id', feeId)
        .single();

    if (fetchError || !feePayment) {
        console.error(`Error fetching fee payment ${feeId}:`, fetchError);
        return { ok: false, message: 'Fee payment record not found.' };
    }

    const newPaidAmount = feePayment.paid_amount + amount;
    let newStatus: PaymentStatus;

    if (newPaidAmount >= feePayment.assigned_amount) {
        newStatus = 'Paid';
    } else if (newPaidAmount > 0) {
        newStatus = 'Partially Paid';
    } else {
        newStatus = 'Pending'; // Should not happen if amount > 0 but good practice
    }

    const updatedNotes = notes ? (feePayment.notes ? `${feePayment.notes}\n${notes}` : notes) : feePayment.notes;

    const { error: updateError } = await supabaseAdmin
        .from('student_fee_payments')
        .update({ paid_amount: newPaidAmount, status: newStatus, notes: updatedNotes, payment_date: new Date().toISOString() })
        .eq('id', feeId);

    if (updateError) {
        console.error(`Error updating fee payment ${feeId}:`, updateError);
        return { ok: false, message: `Failed to record payment: ${updateError.message}` };
    }
    
    revalidatePath('/admin/student-fees');
    revalidatePath('/student/payment-history');
    // Consider revalidating dashboard or other relevant paths if fee status affects them
    revalidatePath('/dashboard'); 

    return { ok: true, message: 'Payment recorded successfully.' };
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
  studentUserId: string,
): Promise<{
    ok: boolean;
    message?: string;
    payments?: StudentFeePayment[];
    feeCategories?: FeeCategory[];
    academicYears?: AcademicYear[];
    studentProfile?: Student | null;
}> {
  if (!studentUserId) {
    return { ok: false, message: "User ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: studentProfile, error: profileError } = await supabase
      .from('students')
      .select('id, school_id, name, email')
      .eq('user_id', studentUserId)
      .single();
    
    if (profileError || !studentProfile) {
        return { ok: false, message: profileError?.message || "Could not load student profile." };
    }

    const { id: studentId, school_id: schoolId } = studentProfile;
    if (!studentId || !schoolId) {
        return { ok: false, message: "Student is not associated with a school." };
    }

    const [paymentsRes, categoriesRes, academicYearsRes] = await Promise.all([
        supabase
        .from('student_fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false, nullsFirst: true })
        .order('due_date', { ascending: false, nullsFirst: true }),
        supabase.from('fee_categories').select('*').eq('school_id', schoolId),
        supabase.from('academic_years').select('*').eq('school_id', schoolId)
    ]);


    if (paymentsRes.error) {
      console.error("Error fetching student payment history:", paymentsRes.error);
      return { ok: false, message: `Database error: ${paymentsRes.error.message}` };
    }
    if (categoriesRes.error) {
        console.warn("Error fetching fee categories for payment history:", categoriesRes.error);
    }
    if (academicYearsRes.error) {
        console.warn("Error fetching academic years for payment history:", academicYearsRes.error);
    }

    return { 
      ok: true, 
      payments: paymentsRes.data || [], 
      feeCategories: categoriesRes.data || [],
      academicYears: academicYearsRes.data || [],
      studentProfile,
    };
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
  installment_id?: string | null;
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
    const { data: overdueFees, error } = await supabase
      .from('student_fee_payments')
      .select('id, due_date')
      .eq('student_id', studentProfileId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue'])
      .lt('due_date', new Date().toISOString()) 
      .limit(1);

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

  if (!razorpayInstance) {
    return { ok: false, message: "Razorpay is not configured on the server." };
  }
  
  try {
    const orderDetails = await razorpayInstance.orders.fetch(razorpay_order_id);
    const paidAmount = orderDetails.amount_paid / 100;
    const feePaymentIds: string[] = JSON.parse(orderDetails.notes?.fee_payment_ids || '[]');
    
    if (feePaymentIds.length === 0) {
      return { ok: false, message: "No fee records found in the payment order." };
    }
    
    let amountToDistribute = paidAmount;
    
    for (const feeId of feePaymentIds) {
        if(amountToDistribute <= 0) break;
        
        const {data: feeRecord, error: fetchError} = await supabaseAdmin.from('student_fee_payments').select('assigned_amount, paid_amount').eq('id', feeId).single();
        if(fetchError || !feeRecord) {
            console.error(`Could not find fee record ${feeId} during payment verification.`);
            continue;
        }

        const dueOnThisRecord = feeRecord.assigned_amount - feeRecord.paid_amount;
        const paymentForThisRecord = Math.min(dueOnThisRecord, amountToDistribute);

        if (paymentForThisRecord > 0) {
          const recordResult = await recordStudentFeePaymentAction({
            fee_payment_id: feeId,
            payment_amount: paymentForThisRecord,
            payment_date: new Date().toISOString(),
            school_id: schoolId
          });
          if(recordResult.ok) {
            amountToDistribute -= paymentForThisRecord;
          }
        }
    }

    revalidatePath('/student/payment-history');
    return { ok: true, message: "Payment verified and recorded successfully!" };
  } catch (error: any) {
    console.error("Error during payment verification process:", error);
    return { ok: false, message: `Payment recorded but verification step failed: ${error.message}` };
  }
}
