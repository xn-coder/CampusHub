
'use server';
import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { User, UserRole } from '@/types';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function ensureSuperAdminExists(): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const superAdminEmail = process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL;
  const superAdminName = process.env.NEXT_PUBLIC_SUPERADMIN_NAME || 'Super Administrator';
  const superAdminPassword = "password";

  if (!superAdminEmail) {
    console.error('Superadmin email not configured in .env');
    return { ok: false, message: 'Superadmin email not configured.' };
  }

  try {
    const { data: existingUser, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', superAdminEmail)
      .single();

    if (userFetchError && userFetchError.code !== 'PGRST116') {
      console.error('Error checking for superadmin existence:', userFetchError);
      return { ok: false, message: 'Error checking for superadmin existence.' };
    }

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(superAdminPassword, SALT_ROUNDS);
      
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          email: superAdminEmail,
          name: superAdminName,
          password_hash: hashedPassword,
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
): Promise<{ ok: boolean; message: string; user?: Omit<User, 'password_hash'> }> {
  const supabaseAdmin = createSupabaseServerClient(); // Use admin client to read users table
  try {
    const { data: userRecord, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, password_hash, school_id, status')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user during login:', fetchError);
      const dbError = (fetchError as any);
      if (dbError?.message?.includes('fetch failed')) {
        return { ok: false, message: 'Database connection failed. Please check your .env configuration and network connection.'};
      }
      return { ok: false, message: `Database query failed: ${dbError.message}. Please check your Supabase credentials and network connection.` };
    }

    if (!userRecord) {
      return { ok: false, message: 'User not found.' };
    }

    if (userRecord.status !== 'Active') {
        if (userRecord.role === 'admin') {
            return { ok: false, message: 'Your admin account has been deactivated by the superadmin. Please contact support.' };
        }
        return { ok: false, message: 'Your user account is inactive. Please contact administration.' };
    }

    if (!userRecord.password_hash) {
        return { ok: false, message: 'User account not properly configured (missing password).' };
    }

    const passwordMatch = await bcrypt.compare(pass, userRecord.password_hash);

    if (!passwordMatch) {
      return { ok: false, message: 'Invalid password.' };
    }

    if (userRecord.role !== role) {
      return { ok: false, message: `Incorrect role selected. Expected ${userRecord.role}.` };
    }

    // Check student status if user is a student
    if (userRecord.role === 'student' && userRecord.school_id) {
        const { data: studentProfile, error: studentError } = await supabaseAdmin
            .from('students')
            .select('id, status')
            .eq('user_id', userRecord.id)
            .eq('school_id', userRecord.school_id)
            .single();
        
        if (studentError && studentError.code !== 'PGRST116') {
            return { ok: false, message: 'Error fetching student profile during login.' };
        }

        if (studentProfile?.status && studentProfile.status !== 'Active') {
            return { ok: false, message: `Your account status is "${studentProfile.status}". Please contact administration.` };
        }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userWithoutPasswordHash } = userRecord;
    return { ok: true, message: 'Login successful!', user: userWithoutPasswordHash as Omit<User, 'password_hash'> };

  } catch (error) {
    console.error('Login error:', error);
    return { ok: false, message: 'An error occurred during login.' };
  }
}
