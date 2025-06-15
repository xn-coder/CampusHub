
'use server';
import prisma from '@/lib/prisma';
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
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash(superAdminPassword, SALT_ROUNDS);
      await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: superAdminName,
          password: hashedPassword,
          role: 'superadmin',
        },
      });
      console.log('Superadmin account created.');
      return { ok: true, message: 'Superadmin account created successfully.' };
    } else if (existingSuperAdmin.role !== 'superadmin') {
      // Optional: Promote existing user to superadmin if email matches but role doesn't
      // For now, we'll just log this potential conflict.
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
    const userRecord = await prisma.user.findUnique({
      where: { email },
    });

    if (!userRecord) {
      return { ok: false, message: 'User not found.' };
    }

    const passwordMatch = await bcrypt.compare(pass, userRecord.password);

    if (!passwordMatch) {
      return { ok: false, message: 'Invalid password.' };
    }

    if (userRecord.role !== role) {
      return { ok: false, message: `Incorrect role selected. Expected ${userRecord.role}.` };
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = userRecord;
    return { ok: true, message: 'Login successful!', user: userWithoutPassword };

  } catch (error) {
    console.error('Login error:', error);
    return { ok: false, message: 'An error occurred during login.' };
  }
}
