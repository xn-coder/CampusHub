
'use server';

import { supabase } from '@/lib/supabaseClient';
import type { AcademicYear as PrismaAcademicYearType } from '@prisma/client'; // Keep this for input type, or define a new one
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

// Define a type for input if not using Prisma's generated type
interface AcademicYearInputType {
  id?: string; // Optional for add
  name: string;
  startDate: string; // Expecting YYYY-MM-DD string from date input
  endDate: string;   // Expecting YYYY-MM-DD string from date input
  school_id: string; // Assuming column name is school_id
}

// Define a type for Supabase row, assuming snake_case
interface AcademicYearSupabaseRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  school_id: string;
  created_at?: string;
}


export async function addAcademicYearAction(
  data: Omit<AcademicYearInputType, 'id'>
): Promise<{ ok: boolean; message: string; year?: AcademicYearSupabaseRow }> {
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }

    // Check for existing name within the same school
    const { data: existingYear, error: fetchError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('name', data.name)
        .eq('school_id', data.school_id)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error checking for existing academic year:', fetchError);
        return { ok: false, message: 'Database error checking for existing year.' };
    }
    if (existingYear) {
        return { ok: false, message: 'An academic year with this name already exists for this school.' };
    }

    const newYearId = uuidv4();
    const { data: newYear, error: insertError } = await supabase
      .from('academic_years')
      .insert({
        id: newYearId,
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
        school_id: data.school_id,
      })
      .select()
      .single();
    
    if (insertError) {
        console.error('Error adding academic year:', insertError);
        return { ok: false, message: `Failed to add academic year: ${insertError.message}` };
    }
    if (!newYear) {
        return { ok: false, message: 'Failed to add academic year (no data returned).' };
    }

    revalidatePath('/admin/academic-years');
    return { ok: true, message: `Academic Year "${newYear.name}" added.`, year: newYear };
  } catch (error) {
    console.error('Unexpected error adding academic year:', error);
    return { ok: false, message: 'Failed to add academic year due to an unexpected error.' };
  }
}


export async function updateAcademicYearAction(
  data: AcademicYearInputType & { id: string }
): Promise<{ ok: boolean; message: string; year?: AcademicYearSupabaseRow }> {
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }

    // Check if the new name conflicts with another existing year for the same school
    const { data: conflictingYear, error: fetchError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('name', data.name)
        .eq('school_id', data.school_id)
        .neq('id', data.id) // Exclude the current year being updated
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking for conflicting academic year name:', fetchError);
        return { ok: false, message: 'Database error checking for name conflict.' };
    }
    if (conflictingYear) {
        return { ok: false, message: 'Another academic year with this name already exists for this school.' };
    }
    
    const { data: updatedYear, error: updateError } = await supabase
      .from('academic_years')
      .update({
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
        // school_id should not change during an update of this nature usually
      })
      .eq('id', data.id)
      .select()
      .single();

    if (updateError) {
        console.error('Error updating academic year:', updateError);
        return { ok: false, message: `Failed to update academic year: ${updateError.message}` };
    }
    if (!updatedYear) {
         return { ok: false, message: 'Failed to update academic year (no data returned).' };
    }

    revalidatePath('/admin/academic-years');
    return { ok: true, message: `Academic Year "${updatedYear.name}" updated.`, year: updatedYear };
  } catch (error) {
    console.error('Unexpected error updating academic year:', error);
    return { ok: false, message: 'Failed to update academic year due to an unexpected error.' };
  }
}

export async function deleteAcademicYearAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  try {
    // Consider checking for dependencies (e.g., if subjects or exams are linked to this year)
    // This requires querying related tables. For example:
    // const { data: subjects, error: subjectsError } = await supabase
    //   .from('subjects').select('id', { count: 'exact' }).eq('academic_year_id', id);
    // if (subjects && subjects.length > 0) return { ok: false, message: 'Cannot delete: Subjects linked.'}

    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting academic year:', error);
      // Supabase error for foreign key constraint might be code '23503'
      if (error.code === '23503') {
          return { ok: false, message: 'Cannot delete academic year. It is still referenced by other records (e.g., subjects, exams).' };
      }
      return { ok: false, message: `Failed to delete academic year: ${error.message}` };
    }
    revalidatePath('/admin/academic-years');
    return { ok: true, message: 'Academic Year deleted.' };
  } catch (error) {
    console.error('Unexpected error deleting academic year:', error);
    return { ok: false, message: 'Failed to delete academic year due to an unexpected error.' };
  }
}
