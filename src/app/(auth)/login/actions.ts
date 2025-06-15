
'use server';
import { supabase } from '@/lib/supabaseClient';
import type { User, UserRole } from '@/types';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function ensureSuperAdminExists(): Promise<{ ok: boolean; message: string }> {
  const superAdminEmail = process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL;
  const superAdminName = process.env.NEXT_PUBLIC_SUPERADMIN_NAME || 'Super Administrator';
  const superAdminPassword = "password"; // Hardcoded default password

  if (!superAdminEmail) {
    console.error('Superadmin email not configured in .env');
    return { ok: false, message: 'Superadmin email not configured.' };
  }

  try {
    // Check if superadmin exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', superAdminEmail)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: 0 rows
      console.error('Error fetching superadmin:', fetchError);
      return { ok: false, message: 'Error checking for superadmin existence.' };
    }

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(superAdminPassword, SALT_ROUNDS);
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          email: superAdminEmail,
          name: superAdminName,
          password_hash: hashedPassword, // Assuming column is named password_hash
          role: 'superadmin',
        });

      if (insertError) {
        console.error('Error creating superadmin:', insertError);
        return { ok: false, message: 'Failed to create superadmin account.' };
      }
      console.log('Superadmin account created.');
      return { ok: true, message: 'Superadmin account created successfully.' };
    } else if (existingUser.role !== 'superadmin') {
      console.warn(`User with email ${superAdminEmail} exists but is not superadmin. Manual review needed.`);
      return { ok: false, message: 'Superadmin configuration conflict.'};
    }
    return { ok: true, message: 'Superadmin already exists.' };
  } catch (error) {
    console.error('Error ensuring superadmin exists:', error);
    return { ok: false, message: 'Failed to ensure superadmin account.' };
  }
}

export async function attemptLogin(
  email: string,
  pass: string,
  role: UserRole
): Promise<{ ok: boolean; message: string; user?: Omit<User, 'password'> }> {
  try {
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, role, password_hash') // Fetch password_hash
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user during login:', fetchError);
      return { ok: false, message: 'Error during login process.' };
    }

    if (!userRecord) {
      return { ok: false, message: 'User not found.' };
    }

    const passwordMatch = await bcrypt.compare(pass, userRecord.password_hash);

    if (!passwordMatch) {
      return { ok: false, message: 'Invalid password.' };
    }

    if (userRecord.role !== role) {
      return { ok: false, message: `Incorrect role selected. Expected ${userRecord.role}.` };
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPasswordHash } = userRecord;
    return { ok: true, message: 'Login successful!', user: userWithoutPasswordHash as Omit<User, 'password'> };

  } catch (error) {
    console.error('Login error:', error);
    return { ok: false, message: 'An error occurred during login.' };
  }
}
