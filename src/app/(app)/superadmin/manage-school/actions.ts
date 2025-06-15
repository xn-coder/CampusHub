
'use server';

import { supabase } from '@/lib/supabaseClient';
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
    const { error } = await supabase
      .from('schools')
      .update({
        name: data.name,
        address: data.address,
        // status: data.status, // if status update is needed
      })
      .eq('id', data.id);

    if (error) {
      console.error('Error updating school:', error);
      return { ok: false, message: `Failed to update school: ${error.message}` };
    }

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School "${data.name}" updated successfully.` };
  } catch (error) {
    console.error('Unexpected error updating school:', error);
    return { ok: false, message: 'An unexpected error occurred while updating school.' };
  }
}

export async function deleteSchoolAction(
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    // Check if school exists before attempting to delete
    const { data: schoolToDelete, error: fetchError } = await supabase
        .from('schools')
        .select('id, admin_user_id') // admin_user_id for potential linked user deletion
        .eq('id', schoolId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means 0 rows, so school not found
        console.error('Error fetching school for deletion:', fetchError);
        return { ok: false, message: "Error finding school to delete."};
    }
    if (!schoolToDelete) {
        return { ok: false, message: "School not found."};
    }
    
    // Note: This only deletes the school record.
    // The associated admin user in the users table is NOT deleted automatically by this action.
    // You might want to implement logic to handle the admin user, e.g., by:
    // 1. Disallowing school deletion if the admin user still exists and is linked.
    // 2. Deleting or deactivating the admin user (requires careful consideration of dependencies).
    // For now, focusing on deleting the school record itself.

    // Before deleting the school, check for dependent records in other tables.
    // Example: Check for academic_years linked to this school.
    const { data: academicYears, error: ayError } = await supabase
      .from('academic_years')
      .select('id', { count: 'exact' })
      .eq('school_id', schoolId);

    if (ayError) {
      console.error('Error checking academic years for school:', ayError);
      return { ok: false, message: 'Failed to check school dependencies.' };
    }
    if (academicYears && academicYears.length > 0) { // Supabase count is often in a separate data structure or header, check docs
      return { ok: false, message: 'Failed to delete school: It has associated academic years. Please remove them first.' };
    }
    // Add similar checks for other dependent tables (classes, students, etc.)

    const { error: deleteError } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId);

    if (deleteError) {
      console.error('Error deleting school:', deleteError);
      // Check for foreign key constraint violation (Supabase error codes might differ from Prisma)
      // Example: if (deleteError.code === '23503') for foreign key violation
      return { ok: false, message: `Failed to delete school: ${deleteError.message}. It might have associated records.` };
    }

    revalidatePath('/superadmin/manage-school');
    return { ok: true, message: `School record deleted successfully.` };
  } catch (error) {
    console.error('Unexpected error deleting school:', error);
    return { ok: false, message: 'An unexpected error occurred while deleting the school.' };
  }
}
