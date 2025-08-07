
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { SchoolEntry } from '@/types';

export async function getSchoolsAction(): Promise<{ ok: boolean; schools?: SchoolEntry[], message?: string }> {
    const supabase = createSupabaseServerClient(); // Uses service role key on server
    try {
        const { data, error } = await supabase
            .from('schools')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching schools in action:", error);
            return { ok: false, message: `Database error: ${error.message}` };
        }
        return { ok: true, schools: data as SchoolEntry[] };

    } catch (e: any) {
        console.error("Unexpected error in getSchoolsAction:", e);
        return { ok: false, message: e.message || 'An unexpected server error occurred.' };
    }
}


// The update and delete actions were already in a separate actions file, but consolidating here for clarity.
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
    const dependencies = [
      { table: 'students', label: 'Student' },
      { table: 'teachers', label: 'Teacher' },
      { table: 'classes', label: 'Class' },
      { table: 'academic_years', label: 'Academic Year' },
      { table: 'subjects', label: 'Subject' },
      { table: 'expenses', label: 'Expense Record' },
    ];

    for (const dep of dependencies) {
      const { count, error } = await supabaseAdmin
        .from(dep.table)
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId);

      if (error) {
        // If a table doesn't exist, it's not a blocking error, just a warning.
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.warn(`Dependency check skipped: table "${dep.table}" does not exist.`);
          continue;
        }
        console.error(`Error checking ${dep.label} dependencies for school:`, error);
        return { ok: false, message: `Failed to check school dependencies for ${dep.label} records.` };
      }
      if (count && count > 0) {
        return { ok: false, message: `Failed to delete school: It has ${count} associated ${dep.label}(s). Please remove them first.` };
      }
    }
    
    // If we've passed all dependency checks, proceed with deletion
    const { error: deleteError } = await supabaseAdmin
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
