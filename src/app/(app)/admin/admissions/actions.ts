
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AdmissionStatus, AdmissionRecord, ClassData, StudentFeePayment, FeeCategory, PaymentStatus, UserRole, Student } from '@/types';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 10;

export async function fetchAdminSchoolIdForAdmissions(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("fetchAdminSchoolIdForAdmissions: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school for admissions:", error?.message);
    return null;
  }
  return school.id;
}

export async function fetchAdmissionPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  admissions?: AdmissionRecord[];
  classes?: ClassData[];
  feeCategories?: FeeCategory[];
  feePayments?: StudentFeePayment[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [admissionsRes, classesRes, feeCategoriesRes, feePaymentsRes] = await Promise.all([
        supabaseAdmin.from('admission_records').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabaseAdmin.from('classes').select('id, name, division').eq('school_id', schoolId),
        supabaseAdmin.from('fee_categories').select('id, name').eq('school_id', schoolId),
        supabaseAdmin.from('student_fee_payments').select('*').eq('school_id', schoolId),
    ]);

    if (admissionsRes.error) throw new Error(`Failed to fetch admissions: ${admissionsRes.error.message}`);
    if (classesRes.error) throw new Error(`Failed to fetch classes: ${classesRes.error.message}`);
    if (feeCategoriesRes.error) throw new Error(`Failed to fetch fee categories: ${feeCategoriesRes.error.message}`);
    if (feePaymentsRes.error) throw new Error(`Failed to fetch fee payments: ${feePaymentsRes.error.message}`);
    
    return { 
        ok: true, 
        admissions: admissionsRes.data || [], 
        classes: classesRes.data || [],
        feeCategories: feeCategoriesRes.data || [],
        feePayments: feePaymentsRes.data || [],
    };
  } catch (error: any) {
    console.error("Unexpected error in fetchAdmissionPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}


export async function updateAdmissionStatusAction(
  admissionId: string,
  newStatus: AdmissionStatus,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  const { error } = await supabaseAdmin
    .from('admission_records')
    .update({ status: newStatus })
    .eq('id', admissionId)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error updating admission status:", error);
    return { ok: false, message: `Failed to update admission status: ${error.message}` };
  }

  revalidatePath('/admin/admissions');
  return { ok: true, message: `Admission status updated to ${newStatus}.` };
}

// --- New Admission Actions ---

export async function getNewAdmissionPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  classes?: ClassData[];
  feeCategories?: FeeCategory[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const [classesRes, feeCategoriesRes] = await Promise.all([
      supabase.from('classes').select('id, name, division').eq('school_id', schoolId).order('name'),
      supabase.from('fee_categories').select('*').eq('school_id', schoolId).order('name')
    ]);

    if (classesRes.error) throw new Error(`Failed to fetch classes: ${classesRes.error.message}`);
    if (feeCategoriesRes.error) throw new Error(`Failed to fetch fee categories: ${feeCategoriesRes.error.message}`);
    
    return { 
        ok: true, 
        classes: classesRes.data || [],
        feeCategories: feeCategoriesRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getNewAdmissionPageDataAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}


interface AdmitStudentInput {
  name: string;
  email: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  classId: string; 
  schoolId: string;
  profilePictureUrl?: string;
  feeCategoryIds?: string[];
}

export async function admitNewStudentAction(
  input: AdmitStudentInput
): Promise<{ ok: boolean; message: string; studentId?: string; userId?: string; admissionRecordId?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { 
    name, email, dateOfBirth, guardianName, contactNumber, address, classId, schoolId, profilePictureUrl, feeCategoryIds 
  } = input;
  const defaultPassword = "password";

  try {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
      console.error('Error checking existing user:', userFetchError);
      return { ok: false, message: 'Database error while checking user email.' };
    }
    if (existingUser) {
      return { ok: false, message: `A user with email ${email.trim()} already exists.` };
    }

    const newUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
    const { data: newUser, error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        email: email.trim(),
        name: name.trim(),
        role: 'student',
        password_hash: hashedPassword,
        school_id: schoolId,
      })
      .select('id')
      .single();

    if (userInsertError || !newUser) {
      console.error('Error creating user account:', userInsertError);
      return { ok: false, message: `Failed to create student login: ${userInsertError?.message || 'No user data returned'}` };
    }

    const newStudentProfileId = uuidv4();
    const { error: studentInsertError } = await supabaseAdmin
      .from('students')
      .insert({
        id: newStudentProfileId,
        user_id: newUser.id,
        name: name.trim(),
        email: email.trim(),
        class_id: classId,
        date_of_birth: dateOfBirth || null,
        guardian_name: guardianName || null,
        contact_number: contactNumber || null,
        address: address || null,
        admission_date: new Date().toISOString().split('T')[0],
        profile_picture_url: profilePictureUrl?.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`,
        school_id: schoolId,
      });

    if (studentInsertError) {
      console.error('Error creating student profile:', studentInsertError);
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      return { ok: false, message: `Failed to create student profile: ${studentInsertError.message}` };
    }

    let feesAssignedCount = 0;
    if (feeCategoryIds && feeCategoryIds.length > 0) {
      try {
        const { data: selectedFeeCategories, error: feeCategoryError } = await supabaseAdmin
          .from('fee_categories')
          .select('id, amount')
          .in('id', feeCategoryIds)
          .eq('school_id', schoolId);

        if (feeCategoryError) {
          console.warn(`Could not fetch selected Fee categories: ${feeCategoryError.message}`);
        } else if (selectedFeeCategories && selectedFeeCategories.length > 0) {
          
          const feePaymentsToInsert = selectedFeeCategories
            .filter(category => category.amount !== null && category.amount >= 0)
            .map(category => ({
              id: uuidv4(),
              student_id: newStudentProfileId,
              fee_category_id: category.id,
              class_id: classId, // Store class context at time of fee assignment
              assigned_amount: category.amount,
              paid_amount: 0,
              status: 'Pending' as PaymentStatus,
              payment_date: null,
              due_date: new Date().toISOString().split('T')[0],
              school_id: schoolId,
          }));

          if (feePaymentsToInsert.length > 0) {
            const { error: feeInsertError } = await supabaseAdmin
              .from('student_fee_payments')
              .insert(feePaymentsToInsert);

            if (feeInsertError) {
              console.warn(`Failed to assign selected fees to student ${newStudentProfileId}: ${feeInsertError.message}`);
            } else {
              feesAssignedCount = feePaymentsToInsert.length;
              console.log(`Successfully assigned ${feesAssignedCount} PENDING fees to student ${newStudentProfileId}.`);
              revalidatePath('/admin/student-fees');
              revalidatePath('/student/payment-history');
              revalidatePath('/dashboard');
            }
          }
        }
      } catch (feeError: any) {
        console.warn(`An error occurred during fee assignment: ${feeError.message}`);
      }
    }

    const newAdmissionId = uuidv4();
    const { error: admissionInsertError } = await supabaseAdmin
        .from('admission_records')
        .insert({
            id: newAdmissionId,
            name: name.trim(),
            email: email.trim(),
            date_of_birth: dateOfBirth || null,
            guardian_name: guardianName || null,
            contact_number: contactNumber || null,
            address: address || null,
            admission_date: new Date().toISOString().split('T')[0],
            status: 'Admitted' as AdmissionStatus, 
            class_id: classId,
            student_profile_id: newStudentProfileId,
            school_id: schoolId,
        });
    
    if (admissionInsertError) {
        console.warn('Error creating admission record:', admissionInsertError);
    }

    revalidatePath('/admin/admissions'); 
    revalidatePath('/admin/manage-students');
    
    const message = `Student ${name} admitted and account created. ${feesAssignedCount > 0 ? `${feesAssignedCount} fee(s) have been assigned and are pending payment.` : ''} Default password is "password".`;
    
    return { 
      ok: true, 
      message,
      studentId: newStudentProfileId,
      userId: newUser.id,
      admissionRecordId: newAdmissionId,
    };

  } catch (error: any) {
    console.error('Unexpected error during student admission:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
