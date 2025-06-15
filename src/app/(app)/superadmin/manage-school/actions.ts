
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

interface UpdateSchoolInput {
  id: string;
  name: string;
  address: string;
  // status: 'Active' | 'Inactive'; // If status change is also allowed
}

export async function updateSchoolAction(
  data: UpdateSchoolInput
): Promise<{ ok: boolean; message: string }> {
  try {
    await prisma.school.update({
      where: { id: data.id },
      data: {
        name: data.name,
        address: data.address,
        // status: data.status,
      },
    });
    revalidatePath('/superadmin/manage-school'); // Revalidate the page to show updated data
    return { ok: true, message: `School "${data.name}" updated successfully.` };
  } catch (error) {
    console.error('Error updating school:', error);
    return { ok: false, message: 'Failed to update school.' };
  }
}

export async function deleteSchoolAction(
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    // Note: This only deletes the school record.
    // The associated admin user in the User table is NOT deleted automatically by this action.
    // A more robust system might:
    // 1. Disallow deletion if there are dependent entities (classes, students etc. under this school).
    // 2. Offer to soft-delete (mark as inactive).
    // 3. Cascade delete or prompt for deletion of the associated admin user.
    // For now, keeping it simple as per the original localStorage behavior.
    
    const schoolToDelete = await prisma.school.findUnique({ where: {id: schoolId}});
    if (!schoolToDelete) {
        return { ok: false, message: "School not found."};
    }
    
    // If you want to delete the associated admin user (USE WITH CAUTION):
    // if (schoolToDelete.adminUserId) {
    //   await prisma.user.delete({ where: { id: schoolToDelete.adminUserId }});
    // }

    await prisma.school.delete({
      where: { id: schoolId },
    });

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School record deleted successfully.` };
  } catch (error) {
    console.error('Error deleting school:', error);
    if (error instanceof Error && 'code' in error && error.code === 'P2003'){ // Foreign key constraint
         return { ok: false, message: 'Failed to delete school: It has associated records (e.g., academic years, classes). Please remove them first.' };
    }
    return { ok: false, message: 'Failed to delete school.' };
  }
}
