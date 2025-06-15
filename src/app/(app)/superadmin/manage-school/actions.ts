
'use server';

import { supabase } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

interface UpdateSchoolInput {
  id: string;
  name: string;
  address: string;
  status: 'Active' | 'Inactive'; 
}

export async function updateSchoolAction(
  data: UpdateSchoolInput
): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('schools')
      .update({
        name: data.name,
        address: data.address,
        status: data.status,
      })
      .eq('id', data.id);

    if (error) {
      console.error('Error updating school:', error);
      return { ok: false, message: `Failed to update school: ${error.message}` };
    }

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School "${data.name}" updated successfully.` };
  } catch (error: any) {
    console.error('Unexpected error updating school:', error);
    return { ok: false, message: `An unexpected error occurred while updating school: ${error.message}` };
  }
}

export async function deleteSchoolAction(
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    // Check if school exists before attempting to delete
    const { data: schoolToDelete, error: fetchError } = await supabase
        .from('schools')
        .select('id, admin_user_id') 
        .eq('id', schoolId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
        console.error('Error fetching school for deletion:', fetchError);
        return { ok: false, message: "Error finding school to delete."};
    }
    if (!schoolToDelete) {
        return { ok: false, message: "School not found."};
    }
    
    // Check for dependent academic_years linked to this school.
    const { data: academicYears, error: ayError, count: ayCount } = await supabase
      .from('academic_years')
      .select('id', { count: 'exact', head: true }) // Only need the count
      .eq('school_id', schoolId);

    if (ayError) {
      console.error('Error checking academic years for school:', ayError);
      return { ok: false, message: `Failed to check school dependencies: ${ayError.message}` };
    }
    if (ayCount && ayCount > 0) { 
      return { ok: false, message: `Failed to delete school: It has ${ayCount} associated academic year(s). Please remove them first.` };
    }
    // Add similar checks for other dependent tables (classes, students, etc.) if necessary

    // Note: The associated admin user in the users table is NOT deleted automatically.
    // Further logic would be needed to handle the admin_user_id from schoolToDelete.admin_user_id
    // For example, by deleting or deactivating them based on policy.

    const { error: deleteError } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId);

    if (deleteError) {
      console.error('Error deleting school:', deleteError);
      return { ok: false, message: `Failed to delete school: ${deleteError.message}. It might have other associated records.` };
    }

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School record deleted successfully.` };
  } catch (error: any) {
    console.error('Unexpected error deleting school:', error);
    return { ok: false, message: `An unexpected error occurred while deleting the school: ${error.message}` };
  }
}

