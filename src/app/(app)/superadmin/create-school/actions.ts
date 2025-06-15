
'use server';

import { supabase } from '@/lib/supabaseClient';
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
  const { schoolName, schoolAddress, adminName, adminEmail } = data;
  const adminPassword = "password"; // Default password

  try {
    // Check if admin email already exists in users table
    const { data: existingUser, error: userFetchError } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine for new user
        console.error('Error checking for existing admin user:', userFetchError);
        return { ok: false, message: 'Database error while checking admin email.' };
    }
    if (existingUser) {
      return { ok: false, message: `Admin email ${adminEmail} already exists.` };
    }

    // Check if school with the same admin email exists (less likely but good practice)
    const { data: existingSchoolByAdminEmail, error: schoolFetchError } = await supabase
        .from('schools')
        .select('id')
        .eq('admin_email', adminEmail) // Assuming column name is admin_email
        .single();
    
    if (schoolFetchError && schoolFetchError.code !== 'PGRST116') {
        console.error('Error checking for existing school by admin email:', schoolFetchError);
        return { ok: false, message: 'Database error while checking school admin email.' };
    }
    if (existingSchoolByAdminEmail) {
        return { ok: false, message: `A school is already associated with admin email ${adminEmail}.` };
    }

    // Create Admin User
    const newAdminUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const { error: adminInsertError } = await supabase
      .from('users')
      .insert({
        id: newAdminUserId, // Manually provide UUID if your table doesn't auto-generate
        email: adminEmail,
        name: adminName,
        password_hash: hashedPassword, // Assuming column is password_hash
        role: 'admin',
      });

    if (adminInsertError) {
      console.error('Error creating admin user:', adminInsertError);
      return { ok: false, message: 'Failed to create admin user account.' };
    }

    // Create School, linking to the new admin user
    const newSchoolId = uuidv4();
    const { error: schoolInsertError } = await supabase
      .from('schools')
      .insert({
        id: newSchoolId, // Manually provide UUID
        name: schoolName,
        address: schoolAddress,
        admin_email: adminEmail, 
        admin_name: adminName,   
        admin_user_id: newAdminUserId, // Assuming column name is admin_user_id
        status: 'Active',
      });

    if (schoolInsertError) {
      console.error('Error creating school:', schoolInsertError);
      // Attempt to clean up user if school creation failed
       await supabase.from('users').delete().eq('id', newAdminUserId);
       console.log(`Cleaned up user ${adminEmail} due to school creation failure.`);
      return { ok: false, message: 'Failed to create school record.' };
    }

    return {
      ok: true,
      message: `School "${schoolName}" and admin account for ${adminName} created successfully. Default password is "password".`,
      schoolId: newSchoolId,
      adminId: newAdminUserId,
    };
  } catch (error) {
    console.error('Error creating school and admin:', error);
    return { ok: false, message: 'Failed to create school and admin. Please check server logs.' };
  }
}
