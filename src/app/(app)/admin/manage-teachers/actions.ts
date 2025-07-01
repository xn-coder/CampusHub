
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

const SALT_ROUNDS = 10;

interface CreateTeacherInput {
  name: string;
  email: string;
  subject: string;
  profilePictureUrl?: string;
  school_id: string; 
}

export async function createTeacherAction(
  data: CreateTeacherInput
): Promise<{ ok: boolean; message: string; teacherId?: string; userId?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { name, email, subject, profilePictureUrl, school_id } = data;
  const defaultPassword = "password"; 

  try {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
      console.error('Error checking for existing user by email:', userFetchError);
      return { ok: false, message: 'Database error checking email.' };
    }
    if (existingUser) {
      return { ok: false, message: `A user with email ${email} already exists.` };
    }
    
    const newUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

    const { data: newUser, error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        email: email.trim(),
        name: name.trim(),
        role: 'teacher',
        password_hash: hashedPassword,
        school_id: school_id, 
      })
      .select('id')
      .single();

    if (userInsertError || !newUser) {
      console.error('Error creating teacher user account:', userInsertError);
      return { ok: false, message: `Failed to create teacher login: ${userInsertError?.message || 'No user data returned'}` };
    }

    const newTeacherProfileId = uuidv4();
    const { error: teacherInsertError } = await supabaseAdmin
      .from('teachers')
      .insert({
        id: newTeacherProfileId,
        user_id: newUser.id,
        name: name.trim(),
        email: email.trim(), 
        subject: subject.trim(),
        profile_picture_url: profilePictureUrl?.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`,
        school_id: school_id,
      });

    if (teacherInsertError) {
      console.error('Error creating teacher profile:', teacherInsertError);
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      return { ok: false, message: `Failed to create teacher profile: ${teacherInsertError.message}` };
    }
    
    revalidatePath('/admin/manage-teachers');
    return { 
        ok: true, 
        message: `Teacher ${name} created with login. Default password: "password".`,
        teacherId: newTeacherProfileId,
        userId: newUser.id
    };
  } catch (error: any) {
    console.error('Unexpected error creating teacher:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

interface UpdateTeacherInput {
  id: string; 
  userId?: string; 
  name: string;
  email: string;
  subject: string;
  profilePictureUrl?: string;
  school_id: string;
}

export async function updateTeacherAction(
  data: UpdateTeacherInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { id, userId, name, email, subject, profilePictureUrl, school_id } = data;
  try {
    if (userId) {
        const { data: currentUserData, error: currentUserFetchError } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', userId)
            .single();
        
        if (currentUserData && email.trim() !== currentUserData.email) {
            const { data: existingUserWithNewEmail, error: fetchError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', email.trim())
                .neq('id', userId) 
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') {
                return { ok: false, message: 'Database error checking for new email uniqueness.' };
            }
            if (existingUserWithNewEmail) {
                return { ok: false, message: 'Another user with this email already exists.' };
            }
        }
    }

    const { error: teacherUpdateError } = await supabaseAdmin
      .from('teachers')
      .update({
        name: name.trim(),
        email: email.trim(), 
        subject: subject.trim(),
        profile_picture_url: profilePictureUrl?.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`,
      })
      .eq('id', id)
      .eq('school_id', school_id);

    if (teacherUpdateError) {
      console.error('Error updating teacher profile:', teacherUpdateError);
      return { ok: false, message: `Failed to update teacher profile: ${teacherUpdateError.message}` };
    }

    if (userId) {
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ name: name.trim(), email: email.trim() })
        .eq('id', userId);
      
      if (userUpdateError) {
         console.warn(`Teacher profile updated, but failed to update user login details: ${userUpdateError.message}`);
      }
    }
    revalidatePath('/admin/manage-teachers');
    return { ok: true, message: `Teacher ${name} updated successfully.` };
  } catch (error: any) {
    console.error('Unexpected error updating teacher:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}


export async function deleteTeacherAction(
  teacherProfileId: string,
  userId: string | undefined,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { count: classCount, error: classError } = await supabaseAdmin
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', teacherProfileId)
        .eq('school_id', schoolId);

    if (classError) return { ok: false, message: `Error checking class assignments: ${classError.message}`};
    if (classCount && classCount > 0) return { ok: false, message: `Cannot delete: Teacher is assigned to ${classCount} class(es). Unassign first.`};
    
    const { count: assignmentCount, error: assignmentError } = await supabaseAdmin
        .from('assignments')
        .select('id', {count: 'exact', head: true})
        .eq('teacher_id', teacherProfileId)
        .eq('school_id', schoolId); // Assuming assignments are school-scoped
    if (assignmentError) return {ok: false, message: `Error checking assignments: ${assignmentError.message}`};
    if (assignmentCount && assignmentCount > 0) return {ok: false, message: `Cannot delete: Teacher has posted ${assignmentCount} assignment(s).`};

    const { error: teacherDeleteError } = await supabaseAdmin
      .from('teachers')
      .delete()
      .eq('id', teacherProfileId)
      .eq('school_id', schoolId);

    if (teacherDeleteError) {
      console.error('Error deleting teacher profile:', teacherDeleteError);
      return { ok: false, message: `Failed to delete teacher profile: ${teacherDeleteError.message}` };
    }

    if (userId) {
      const { error: userDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);
      if (userDeleteError) {
        console.warn(`Teacher profile deleted, but failed to delete user login for ID ${userId}: ${userDeleteError.message}`);
      }
    }
    revalidatePath('/admin/manage-teachers');
    return { ok: true, message: 'Teacher record and login deleted successfully.' };
  } catch (error: any) {
    console.error('Unexpected error deleting teacher:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
