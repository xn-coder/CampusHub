
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 10;

interface CreateSchoolInput {
  schoolName: string;
  schoolAddress: string;
  adminName: string;
  adminEmail: string;
}

export async function createSchoolAndAdminAction(
  data: CreateSchoolInput
): Promise<{ ok: boolean; message: string; schoolId?: string; adminId?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { schoolName, schoolAddress, adminName, adminEmail } = data;
  const adminPassword = "password"; 

  try {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
        console.error('Error checking for existing admin user:', userFetchError);
        return { ok: false, message: 'Database error while checking admin email.' };
    }
    if (existingUser) {
      return { ok: false, message: `Admin email ${adminEmail} already exists.` };
    }

    const { data: existingSchoolByAdminEmail, error: schoolFetchError } = await supabaseAdmin
        .from('schools')
        .select('id')
        .eq('admin_email', adminEmail) 
        .single();
    
    if (schoolFetchError && schoolFetchError.code !== 'PGRST116') {
        console.error('Error checking for existing school by admin email:', schoolFetchError);
        return { ok: false, message: 'Database error while checking school admin email.' };
    }
    if (existingSchoolByAdminEmail) {
        return { ok: false, message: `A school is already associated with admin email ${adminEmail}.` };
    }

    const newAdminUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const { data: newUser, error: adminInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newAdminUserId, 
        email: adminEmail,
        name: adminName,
        password_hash: hashedPassword,
        role: 'admin',
      })
      .select('id')
      .single();

    if (adminInsertError || !newUser) {
      console.error('Error creating admin user:', adminInsertError);
      return { ok: false, message: `Failed to create admin user account: ${adminInsertError?.message || 'No user data returned'}` };
    }

    const newSchoolId = uuidv4();
    const { error: schoolInsertError } = await supabaseAdmin
      .from('schools')
      .insert({
        id: newSchoolId, 
        name: schoolName,
        address: schoolAddress,
        admin_email: adminEmail, 
        admin_name: adminName,   
        admin_user_id: newAdminUserId, 
        status: 'Active',
      });

    if (schoolInsertError) {
      console.error('Error creating school:', schoolInsertError);
       await supabaseAdmin.from('users').delete().eq('id', newAdminUserId);
       console.log(`Cleaned up user ${adminEmail} due to school creation failure.`);
      return { ok: false, message: `Failed to create school record: ${schoolInsertError.message}` };
    }
    
    // After creating the school, link it to the admin user record.
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({ school_id: newSchoolId })
      .eq('id', newAdminUserId);
    
    if (updateUserError) {
      console.error(`CRITICAL: School ${newSchoolId} created, but failed to link admin user ${newAdminUserId}:`, updateUserError);
      // Rollback school and user creation for data consistency
      await supabaseAdmin.from('schools').delete().eq('id', newSchoolId);
      await supabaseAdmin.from('users').delete().eq('id', newAdminUserId);
      return { ok: false, message: `Failed to link admin to the new school. The creation process has been rolled back.` };
    }

    return {
      ok: true,
      message: `School "${schoolName}" and admin account for ${adminName} created successfully. Default password is "password".`,
      schoolId: newSchoolId,
      adminId: newAdminUserId,
    };
  } catch (error: any) {
    console.error('Error creating school and admin:', error);
    return { ok: false, message: `Failed to create school and admin: ${error.message || 'Please check server logs.'}` };
  }
}
