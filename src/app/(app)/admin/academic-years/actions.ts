
'use server';

import prisma from '@/lib/prisma';
import type { AcademicYear } from '@prisma/client';
import { revalidatePath } from 'next/cache';

interface AcademicYearInput {
  name: string;
  startDate: string; // Expecting YYYY-MM-DD string from date input
  endDate: string;   // Expecting YYYY-MM-DD string from date input
  schoolId: string;
}

export async function addAcademicYearAction(
  data: AcademicYearInput
): Promise<{ ok: boolean; message: string; year?: AcademicYear }> {
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }

    const newYear = await prisma.academicYear.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        schoolId: data.schoolId,
      },
    });
    revalidatePath('/admin/academic-years');
    return { ok: true, message: `Academic Year "${newYear.name}" added.`, year: newYear };
  } catch (error) {
    console.error('Error adding academic year:', error);
    if (error instanceof Error && 'code' in error && error.code === 'P2002' && 'meta' in error && typeof error.meta === 'object' && error.meta && 'target' in error.meta && (error.meta.target as string[]).includes('name')) {
        return { ok: false, message: 'An academic year with this name already exists for this school.' };
    }
    return { ok: false, message: 'Failed to add academic year.' };
  }
}

interface UpdateAcademicYearInput extends AcademicYearInput {
  id: string;
}

export async function updateAcademicYearAction(
  data: UpdateAcademicYearInput
): Promise<{ ok: boolean; message: string; year?: AcademicYear }> {
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }
    
    const updatedYear = await prisma.academicYear.update({
      where: { id: data.id },
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        // schoolId should not change during an update of this nature
      },
    });
    revalidatePath('/admin/academic-years');
    return { ok: true, message: `Academic Year "${updatedYear.name}" updated.`, year: updatedYear };
  } catch (error) {
    console.error('Error updating academic year:', error);
     if (error instanceof Error && 'code' in error && error.code === 'P2002' && 'meta' in error && typeof error.meta === 'object' && error.meta && 'target' in error.meta && (error.meta.target as string[]).includes('name')) {
        return { ok: false, message: 'Another academic year with this name already exists for this school.' };
    }
    return { ok: false, message: 'Failed to update academic year.' };
  }
}

export async function deleteAcademicYearAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  try {
    // Consider checking for dependencies (e.g., if subjects or exams are linked to this year)
    // before allowing deletion in a real application.
    await prisma.academicYear.delete({
      where: { id },
    });
    revalidatePath('/admin/academic-years');
    return { ok: true, message: 'Academic Year deleted.' };
  } catch (error) {
    console.error('Error deleting academic year:', error);
    // Prisma error P2003 is for foreign key constraint violation
    if (error instanceof Error && 'code' in error && error.code === 'P2003') {
        return { ok: false, message: 'Cannot delete academic year. It is still referenced by other records (e.g., subjects, exams).' };
    }
    return { ok: false, message: 'Failed to delete academic year.' };
  }
}
