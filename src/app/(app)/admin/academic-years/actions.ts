
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

interface AcademicYearInputType {
  id?: string; 
  name: string;
  startDate: string; 
  endDate: string;   
  school_id: string; 
}

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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }

    const { data: existingYear, error: fetchError } = await supabaseAdmin
        .from('academic_years')
        .select('id')
        .eq('name', data.name)
        .eq('school_id', data.school_id)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
        console.error('Error checking for existing academic year:', fetchError);
        return { ok: false, message: 'Database error checking for existing year.' };
    }
    if (existingYear) {
        return { ok: false, message: 'An academic year with this name already exists for this school.' };
    }

    const newYearId = uuidv4();
    const { data: newYear, error: insertError } = await supabaseAdmin
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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      return { ok: false, message: 'Start Date must be before End Date.' };
    }

    const { data: conflictingYear, error: fetchError } = await supabaseAdmin
        .from('academic_years')
        .select('id')
        .eq('name', data.name)
        .eq('school_id', data.school_id)
        .neq('id', data.id) 
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking for conflicting academic year name:', fetchError);
        return { ok: false, message: 'Database error checking for name conflict.' };
    }
    if (conflictingYear) {
        return { ok: false, message: 'Another academic year with this name already exists for this school.' };
    }
    
    const { data: updatedYear, error: updateError } = await supabaseAdmin
      .from('academic_years')
      .update({
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { error } = await supabaseAdmin
      .from('academic_years')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting academic year:', error);
      if (error.code === '23503') { // Foreign key violation
          return { ok: false, message: 'Cannot delete academic year. It is still referenced by other records (e.g., subjects, exams, classes).' };
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
