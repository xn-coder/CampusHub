
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { StudentFeePayment, PaymentStatus, Student, FeeCategory, AcademicYear, ClassData } from '@/types';
import { isPast, startOfDay } from 'date-fns';


interface AssignFeeInput {
  student_id: string;
  fee_category_id: string;
  assigned_amount: number;
  due_date?: string;
  notes?: string;
  academic_year_id?: string;
  school_id: string;
}

export async function fetchAdminSchoolIdForFees(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("fetchAdminSchoolIdForFees: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();

  if (error || !school) {
    console.error("Error fetching admin's school for fees:", error?.message);
    return null;
  }
  return school.id;
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
  academic_year_id?: string;
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
        for (const category of categoriesData) {
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

export async function studentPayFeeAction(
  feePaymentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // First, get the full details of the fee assignment to ensure it exists and get assigned amount
  const { data: feePayment, error: fetchError } = await supabaseAdmin
    .from('student_fee_payments')
    .select('assigned_amount')
    .eq('id', feePaymentId)
    .eq('school_id', schoolId)
    .single();

  if (fetchError || !feePayment) {
    console.error("Error fetching fee payment for student payment:", fetchError);
    return { ok: false, message: "Fee assignment not found or could not be verified." };
  }

  // Update the record to be fully paid
  const { error: updateError } = await supabaseAdmin
    .from('student_fee_payments')
    .update({
      paid_amount: feePayment.assigned_amount, // Mark as fully paid
      status: 'Paid',
      payment_date: new Date().toISOString(),
    })
    .eq('id', feePaymentId);

  if (updateError) {
    console.error("Error updating fee status during student payment:", updateError);
    return { ok: false, message: `Failed to process payment: ${updateError.message}` };
  }

  // Revalidate paths to refresh data on relevant pages
  revalidatePath('/student/payment-history');
  revalidatePath('/admin/student-fees');
  revalidatePath('/dashboard'); // To update the pending fee count

  return { ok: true, message: "Payment successful! The fee status has been updated." };
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
      .in('status', ['Pending', 'Partially Paid', 'Overdue']);

    if (error) {
      console.error("Error fetching student fee status:", error);
      return { ok: false, isDefaulter: false, message: `Database error: ${error.message}` };
    }

    const today = startOfDay(new Date());
    const isDefaulter = (overdueFees || []).some(fee => 
        fee.due_date && isPast(new Date(fee.due_date))
    );

    const message = isDefaulter
      ? "You have overdue fees. Please clear your dues to access all features."
      : "Fee status is clear.";

    return { ok: true, isDefaulter, message };

  } catch (e: any) {
    console.error("Unexpected error checking fee status:", e);
    return { ok: false, isDefaulter: false, message: `Unexpected error: ${e.message}` };
  }
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
