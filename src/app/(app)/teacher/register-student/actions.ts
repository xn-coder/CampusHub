
'use server';

import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import type { AdmissionRecord, Student, User, AdmissionStatus } from '@/types';

const SALT_ROUNDS = 10;

interface RegisterStudentInput {
  name: string;
  email: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  classId: string; // ID of the 'classes' table record
  schoolId: string;
  profilePictureUrl?: string;
}

export async function registerStudentAction(
  input: RegisterStudentInput
): Promise<{ ok: boolean; message: string; studentId?: string; userId?: string; admissionRecordId?: string }> {
  const { 
    name, email, dateOfBirth, guardianName, contactNumber, address, classId, schoolId, profilePictureUrl 
  } = input;
  const defaultPassword = "password";

  try {
    // 1. Check if email already exists in users table
    const { data: existingUser, error: userFetchError } = await supabase
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

    // 2. Create User record for login
    const newUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);
    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        email: email.trim(),
        name: name.trim(),
        role: 'student',
        password_hash: hashedPassword,
        // school_id: schoolId, // If users table has school_id
      })
      .select('id')
      .single();

    if (userInsertError || !newUser) {
      console.error('Error creating user account:', userInsertError);
      return { ok: false, message: `Failed to create student login: ${userInsertError?.message || 'No user data returned'}` };
    }

    // 3. Create Student profile record
    const newStudentProfileId = uuidv4();
    const { error: studentInsertError } = await supabase
      .from('students')
      .insert({
        id: newStudentProfileId,
        user_id: newUser.id,
        name: name.trim(),
        email: email.trim(), // Denormalized email
        class_id: classId,
        date_of_birth: dateOfBirth || null,
        guardian_name: guardianName || null,
        contact_number: contactNumber || null,
        address: address || null,
        admission_date: new Date().toISOString().split('T')[0], // Current date as YYYY-MM-DD
        profile_picture_url: profilePictureUrl?.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`,
        school_id: schoolId,
      });

    if (studentInsertError) {
      console.error('Error creating student profile:', studentInsertError);
      // Rollback user creation
      await supabase.from('users').delete().eq('id', newUser.id);
      return { ok: false, message: `Failed to create student profile: ${studentInsertError.message}` };
    }
    
    // 4. Create Admission Record
    const newAdmissionId = uuidv4();
    const { error: admissionInsertError } = await supabase
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
            status: 'Enrolled' as AdmissionStatus, // Directly enrolling
            class_id: classId,
            student_profile_id: newStudentProfileId,
            school_id: schoolId,
        });
    
    if (admissionInsertError) {
        console.error('Error creating admission record:', admissionInsertError);
        // Non-critical for student creation itself, but log it.
        // Might want to notify admin or attempt cleanup.
    }


    revalidatePath('/teacher/register-student');
    revalidatePath('/admin/manage-students'); // Admin might see the new student
    revalidatePath('/admin/admissions'); // Admin might see admission record

    return { 
      ok: true, 
      message: `Student ${name} registered and account created. Default password: "password".`,
      studentId: newStudentProfileId,
      userId: newUser.id,
      admissionRecordId: newAdmissionId,
    };

  } catch (error: any) {
    console.error('Unexpected error during student registration:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
