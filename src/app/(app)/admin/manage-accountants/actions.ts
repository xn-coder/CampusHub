
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

const SALT_ROUNDS = 10;

interface CreateAccountantInput {
  name: string;
  email: string;
  school_id: string;
}

interface UpdateAccountantInput {
  id: string; 
  userId?: string; 
  name: string;
  email: string;
  school_id: string;
}

export async function createAccountantAction(
  data: CreateAccountantInput
): Promise<{ ok: boolean; message: string; accountantId?: string; userId?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { name, email, school_id } = data;
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
        role: 'accountant',
        password_hash: hashedPassword,
        school_id: school_id, 
      })
      .select('id')
      .single();

    if (userInsertError || !newUser) {
      console.error('Error creating accountant user account:', userInsertError);
      return { ok: false, message: `Failed to create accountant login: ${userInsertError?.message || 'No user data returned'}` };
    }

    const newAccountantProfileId = uuidv4();
    const { error: accountantInsertError } = await supabaseAdmin
      .from('accountants')
      .insert({
        id: newAccountantProfileId,
        user_id: newUser.id,
        name: name.trim(),
        email: email.trim(), 
        school_id: school_id,
      });

    if (accountantInsertError) {
      console.error('Error creating accountant profile:', accountantInsertError);
      // Clean up the created user if the profile creation fails
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      
      let friendlyMessage = `Failed to create accountant profile: ${accountantInsertError.message}`;
      if (accountantInsertError.message.includes('relation "public.accountants" does not exist')) {
        friendlyMessage = "Database setup incomplete: The 'accountants' table does not exist. Please run the required database migration.";
      }
      return { ok: false, message: friendlyMessage };
    }
    
    revalidatePath('/admin/manage-accountants');
    return { 
        ok: true, 
        message: `Accountant ${name} created with login. Default password: "password".`,
        accountantId: newAccountantProfileId,
        userId: newUser.id
    };
  } catch (error: any) {
    console.error('Unexpected error creating accountant:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

export async function updateAccountantAction(
  data: UpdateAccountantInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { id, userId, name, email, school_id } = data;
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

    const { error: accountantUpdateError } = await supabaseAdmin
      .from('accountants')
      .update({
        name: name.trim(),
        email: email.trim(), 
      })
      .eq('id', id)
      .eq('school_id', school_id);

    if (accountantUpdateError) {
      console.error('Error updating accountant profile:', accountantUpdateError);
      return { ok: false, message: `Failed to update accountant profile: ${accountantUpdateError.message}` };
    }

    if (userId) {
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ name: name.trim(), email: email.trim() })
        .eq('id', userId);
      
      if (userUpdateError) {
         console.warn(`Accountant profile updated, but failed to update user login details: ${userUpdateError.message}`);
      }
    }
    revalidatePath('/admin/manage-accountants');
    return { ok: true, message: `Accountant ${name} updated successfully.` };
  } catch (error: any) {
    console.error('Unexpected error updating accountant:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}


export async function deleteAccountantAction(
  accountantProfileId: string,
  userId: string | undefined,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { error: accountantDeleteError } = await supabaseAdmin
      .from('accountants')
      .delete()
      .eq('id', accountantProfileId)
      .eq('school_id', schoolId);

    if (accountantDeleteError) {
      console.error('Error deleting accountant profile:', accountantDeleteError);
      return { ok: false, message: `Failed to delete accountant profile: ${accountantDeleteError.message}` };
    }

    if (userId) {
      const { error: userDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);
      if (userDeleteError) {
        console.warn(`Accountant profile deleted, but failed to delete user login for ID ${userId}: ${userDeleteError.message}`);
      }
    }
    revalidatePath('/admin/manage-accountants');
    return { ok: true, message: 'Accountant record and login deleted successfully.' };
  } catch (error: any) {
    console.error('Unexpected error deleting accountant:', error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
