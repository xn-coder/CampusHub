
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { error } = await supabaseAdmin
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
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { data: schoolToDelete, error: fetchError } = await supabaseAdmin
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
    
    const { data: academicYears, error: ayError, count: ayCount } = await supabaseAdmin
      .from('academic_years')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId);

    if (ayError) {
      console.error('Error checking academic years for school:', ayError);
      return { ok: false, message: `Failed to check school dependencies: ${ayError.message}` };
    }
    if (ayCount && ayCount > 0) { 
      return { ok: false, message: `Failed to delete school: It has ${ayCount} associated academic year(s). Please remove them first.` };
    }

    const { error: deleteError } = await supabaseAdmin
      .from('schools')
      .delete()
      .eq('id', schoolId);

    if (deleteError) {
      console.error('Error deleting school:', deleteError);
      return { ok: false, message: `Failed to delete school: ${deleteError.message}. It might have other associated records.` };
    }

    // Optionally delete the admin user associated with the school
    // For now, we are not deleting the user account to avoid accidental data loss / complexity.
    // if (schoolToDelete.admin_user_id) {
    //   await supabaseAdmin.from('users').delete().eq('id', schoolToDelete.admin_user_id);
    // }

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School record deleted successfully.` };
  } catch (error: any) {
    console.error('Unexpected error deleting school:', error);
    return { ok: false, message: `An unexpected error occurred while deleting the school: ${error.message}` };
  }
}
