
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { Student, ClassData, AcademicYear } from '@/types';
import { getAdminSchoolIdAction } from '../academic-years/actions';


export async function getStudentsForSchoolAction(schoolId: string): Promise<{ ok: boolean; students?: Student[]; message?: string }> {
    if (!schoolId) {
        return { ok: false, message: "School ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('school_id', schoolId)
            .order('name');

        if (error) {
            throw new Error(error.message);
        }

        return { ok: true, students: data || [] };
    } catch (e: any) {
        console.error("Error fetching students for school:", e.message);
        return { ok: false, message: e.message };
    }
}

export async function getManageStudentsPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  students?: Student[];
  classes?: ClassData[];
  academicYears?: AcademicYear[];
  message?: string;
}> {
  if (!adminUserId) {
    return { ok: false, message: "Admin User ID is required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    const schoolId = await getAdminSchoolIdAction(adminUserId);
    if (!schoolId) {
      return { ok: false, message: "Could not determine admin's school context." };
    }

    const [studentsRes, classesRes, academicYearsRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);

    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);

    return {
      ok: true,
      schoolId: schoolId,
      students: studentsRes.data || [],
      classes: classesRes.data || [],
      academicYears: academicYearsRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in getManageStudentsPageDataAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}


export async function terminateStudentAction(
  studentId: string,
  userId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !userId || !schoolId) {
    return { ok: false, message: 'Student ID, User ID, and School ID are required.' };
  }

  const supabase = createSupabaseServerClient();
  try {
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ status: 'Terminated', class_id: null })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error terminating student profile:', studentUpdateError);
      if (studentUpdateError.message.includes('column "status" does not exist')) {
        return {
          ok: false,
          message: "Database migration needed: 'status' column is missing from the 'students' table. Please run the required SQL migration.",
        };
      }
      return { ok: false, message: `Database error on student profile: ${studentUpdateError.message}` };
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ status: 'Inactive' })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error deactivating user account:', userUpdateError);
      if (userUpdateError.message.includes('column "status" does not exist')) {
        return {
          ok: false,
          message: "Database migration needed: 'status' column is missing from the 'users' table. Please run the required SQL migration.",
        };
      }
      return {
        ok: false,
        message: `Student profile terminated, but failed to deactivate user login: ${userUpdateError.message}`,
      };
    }

    revalidatePath('/admin/manage-students');
    revalidatePath('/class-management');
    revalidatePath('/admin/attendance');

    return { ok: true, message: 'Student terminated and account deactivated successfully.' };
  } catch (e: any) {
    console.error('Unexpected error terminating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}

export async function reactivateStudentAction(
  studentId: string,
  userId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !userId || !schoolId) {
    return { ok: false, message: 'Student ID, User ID, and School ID are required.' };
  }

  const supabase = createSupabaseServerClient();
  try {
    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ status: 'Active' })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error reactivating student profile:', studentUpdateError);
      return { ok: false, message: `Database error on student profile: ${studentUpdateError.message}` };
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ status: 'Active' })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error reactivating user account:', userUpdateError);
      return {
        ok: false,
        message: `Student profile reactivated, but failed to reactivate user login: ${userUpdateError.message}`,
      };
    }

    revalidatePath('/admin/manage-students');

    return { ok: true, message: 'Student reactivated and account enabled successfully.' };
  } catch (e: any) {
    console.error('Unexpected error reactivating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}

interface UpdateStudentInput {
  studentId: string;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  roll_number: string | null;
  class_id: string | null;
  academic_year_id: string | null;
}

export async function updateStudentAction(
  input: UpdateStudentInput
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { studentId, userId, schoolId, name, email, roll_number, class_id, academic_year_id } = input;

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .eq('school_id', schoolId)
      .neq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing user by email:', fetchError);
      return { ok: false, message: 'Database error checking email uniqueness.' };
    }
    if (existingUser) {
      return { ok: false, message: `Another user with the email ${email.trim()} already exists in this school.` };
    }

    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({
        name: name.trim(),
        email: email.trim(),
        roll_number: roll_number || null,
        class_id: class_id,
        academic_year_id: academic_year_id,
      })
      .eq('id', studentId)
      .eq('school_id', schoolId);

    if (studentUpdateError) {
      console.error('Error updating student profile:', studentUpdateError);
      return { ok: false, message: `Failed to update student profile: ${studentUpdateError.message}` };
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        email: email.trim(),
      })
      .eq('id', userId);

    if (userUpdateError) {
      console.warn(`Student profile ${studentId} updated, but failed to associated user login ${userId}: ${userUpdateError.message}`);
    }

    revalidatePath('/admin/manage-students');
    return { ok: true, message: 'Student details updated successfully.' };

  } catch (e: any) {
    console.error('Unexpected error updating student:', e);
    return { ok: false, message: e.message || 'An unexpected error occurred.' };
  }
}


export async function checkFeeStatusAndGenerateTCAction(
  studentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !schoolId) {
    return { ok: false, message: "Student and School IDs are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: pendingFees, error } = await supabase
      .from('student_fee_payments')
      .select('id, assigned_amount, paid_amount')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue']);

    if (error) {
      console.error("Error fetching student fee status for TC:", error);
      return { ok: false, message: `Database error checking fees: ${error.message}` };
    }

    let totalDue = 0;
    if (pendingFees && pendingFees.length > 0) {
      totalDue = pendingFees.reduce((acc, fee) => acc + (fee.assigned_amount - fee.paid_amount), 0);
    }
    
    if (totalDue > 0) {
      return { ok: false, message: `Cannot issue certificate. Student has outstanding dues of ₹${totalDue.toFixed(2)}.` };
    }

    return { ok: true, message: "Fee status clear. Proceeding to generate certificate." };

  } catch (e: any) {
    console.error("Unexpected error checking fee status for TC:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
