
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
    // Check if admin email already exists in User table
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      return { ok: false, message: `Admin email ${adminEmail} already exists.` };
    }

    // Check if school with the same admin email exists (less likely but good practice)
    const existingSchoolByAdminEmail = await prisma.school.findUnique({
        where: { adminEmail: adminEmail }
    });
    if (existingSchoolByAdminEmail) {
        return { ok: false, message: `A school is already associated with admin email ${adminEmail}.` };
    }


    // Create Admin User
    const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const newAdminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        role: 'admin',
      },
    });

    // Create School, linking to the new admin user
    const newSchool = await prisma.school.create({
      data: {
        name: schoolName,
        address: schoolAddress,
        adminEmail: adminEmail, // Storing for reference, actual link is via adminUserId
        adminName: adminName,   // Storing for reference
        adminUserId: newAdminUser.id,
        status: 'Active',
      },
    });

    return {
      ok: true,
      message: `School "${schoolName}" and admin account for ${adminName} created successfully. Default password is "password".`,
      schoolId: newSchool.id,
      adminId: newAdminUser.id,
    };
  } catch (error) {
    console.error('Error creating school and admin:', error);
    // Attempt to clean up if user was created but school creation failed
    if (error instanceof Error && 'meta' in error && typeof error.meta === 'object' && error.meta && 'target' in error.meta && error.meta.target === 'School_adminEmail_key') {
         return { ok: false, message: `A school is already associated with admin email ${adminEmail}.` };
    }
    
    const userToDelete = await prisma.user.findUnique({ where: {email: adminEmail}});
    if(userToDelete && !(await prisma.school.findFirst({where: {adminUserId: userToDelete.id}}))){
        await prisma.user.delete({ where: {id: userToDelete.id }});
        console.log(`Cleaned up user ${adminEmail} due to school creation failure.`);
    }

    return { ok: false, message: 'Failed to create school and admin. Please check server logs.' };
  }
}
