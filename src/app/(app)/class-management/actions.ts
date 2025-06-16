
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

// --- Class Name (Standard) Management ---
export async function addClassNameAction(name: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  if (!name.trim()) return { ok: false, message: 'Class Name cannot be empty.' };
  
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('class_names')
    .select('id')
    .eq('name', name.trim())
    .eq('school_id', schoolId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error("Error checking class name:", fetchError);
    return { ok: false, message: 'Database error checking name.' };
  }
  if (existing) return { ok: false, message: `Class Name '${name.trim()}' already exists.` };

  const { error } = await supabaseAdmin.from('class_names').insert({ name: name.trim(), school_id: schoolId, id: uuidv4() });
  if (error) {
    console.error("Error adding class name:", error);
    return { ok: false, message: `Failed to add class name: ${error.message}` };
  }
  
  revalidatePath('/class-management');
  return { ok: true, message: `Class Name '${name.trim()}' added.` };
}

export async function deleteClassNameAction(id: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  const { count, error: depError } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('class_name_id', id)
    .eq('school_id', schoolId);
  
  if (depError) {
    console.error("Error checking class name dependencies:", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}`};
  }
  if (count && count > 0) return { ok: false, message: `Cannot delete: Class Name is used in ${count} active class-section(s).`};

  const { error } = await supabaseAdmin.from('class_names').delete().eq('id', id).eq('school_id', schoolId);
  if (error) {
    console.error("Error deleting class name:", error);
    return { ok: false, message: `Failed to delete class name: ${error.message}` };
  }

  revalidatePath('/class-management');
  return { ok: true, message: 'Class Name deleted.' };
}

// --- Section/Division Name Management ---
export async function addSectionNameAction(name: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  if (!name.trim()) return { ok: false, message: 'Section Name cannot be empty.' };

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('section_names')
    .select('id')
    .eq('name', name.trim())
    .eq('school_id', schoolId)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error("Error checking section name:", fetchError);
    return { ok: false, message: 'Database error checking name.' };
  }
  if (existing) return { ok: false, message: `Section Name '${name.trim()}' already exists.` };

  const { error } = await supabaseAdmin.from('section_names').insert({ name: name.trim(), school_id: schoolId, id: uuidv4() });
  if (error) {
    console.error("Error adding section name:", error);
    return { ok: false, message: `Failed to add section name: ${error.message}` };
  }

  revalidatePath('/class-management');
  return { ok: true, message: `Section Name '${name.trim()}' added.` };
}

export async function deleteSectionNameAction(id: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  const { count, error: depError } = await supabaseAdmin
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('section_name_id', id)
    .eq('school_id', schoolId);
  
  if (depError) {
    console.error("Error checking section name dependencies:", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}`};
  }
  if (count && count > 0) return { ok: false, message: `Cannot delete: Section Name is used in ${count} active class-section(s).`};

  const { error } = await supabaseAdmin.from('section_names').delete().eq('id', id).eq('school_id', schoolId);
  if (error) {
    console.error("Error deleting section name:", error);
    return { ok: false, message: `Failed to delete section name: ${error.message}` };
  }
  
  revalidatePath('/class-management');
  return { ok: true, message: 'Section Name deleted.' };
}

interface ActivateClassSectionInput {
  classNameId: string;
  sectionNameId: string;
  schoolId: string;
  className: string; 
  sectionName: string; 
  academicYearId?: string;
}
export async function activateClassSectionAction(input: ActivateClassSectionInput) {
  const supabaseAdmin = createSupabaseServerClient();
  const { classNameId, sectionNameId, schoolId, className, sectionName, academicYearId } = input;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('class_name_id', classNameId)
    .eq('section_name_id', sectionNameId)
    .eq('school_id', schoolId)
    .eq(academicYearId ? 'academic_year_id' : 'academic_year_id', academicYearId || null) // This handles matching NULL for academic_year_id if not provided
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error("Error checking for existing class-section:", fetchError);
    return { ok: false, message: `Database error: ${fetchError.message}` };
  }
  if (existing) return { ok: false, message: `Class-Section '${className} - ${sectionName}' is already active${academicYearId ? ' for this academic year' : ''}.` };

  const { error: insertError } = await supabaseAdmin
    .from('classes')
    .insert({ 
      id: uuidv4(),
      class_name_id: classNameId, 
      section_name_id: sectionNameId, 
      school_id: schoolId, 
      name: className, // Denormalized name for easier display
      division: sectionName, // Denormalized division/section name
      academic_year_id: academicYearId || null 
    });

  if (insertError) {
    console.error("Error activating class-section:", insertError);
    return { ok: false, message: `Failed to activate class-section: ${insertError.message}` };
  }
  
  revalidatePath('/class-management');
  return { ok: true, message: `Class-Section '${className} - ${sectionName}' activated.` };
}

export async function deleteActiveClassAction(activeClassId: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  
  // 1. Unassign students from this class
  const { error: studentUpdateError } = await supabaseAdmin
    .from('students')
    .update({ class_id: null })
    .eq('class_id', activeClassId)
    .eq('school_id', schoolId);
  if (studentUpdateError) {
    console.error("Error unassigning students:", studentUpdateError);
    return { ok: false, message: `Failed to unassign students: ${studentUpdateError.message}`};
  }

  // 2. Delete the class record
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', activeClassId).eq('school_id', schoolId);
  if (error) {
    console.error("Error deleting active class-section:", error);
    return { ok: false, message: `Failed to delete active class-section: ${error.message}` };
  }

  revalidatePath('/class-management');
  revalidatePath('/admin/manage-students');
  return { ok: true, message: 'Active Class-Section deleted and students unassigned.' };
}

export async function assignStudentsToClassAction(classId: string, studentIds: string[], schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  
  try {
    // 1. Unassign ALL students currently in this class FOR THIS SCHOOL to make this operation idempotent for the selected students.
    // Alternatively, only unassign those *not* in the new studentIds list. For simplicity, clear and re-assign.
    const { error: unassignError } = await supabaseAdmin
      .from('students')
      .update({ class_id: null })
      .eq('class_id', classId)
      .eq('school_id', schoolId);
    if (unassignError) throw new Error(`Error unassigning existing students: ${unassignError.message}`);

    // 2. Assign selected students to this class
    if (studentIds.length > 0) {
      const { error: assignError } = await supabaseAdmin
        .from('students')
        .update({ class_id: classId })
        .in('id', studentIds)
        .eq('school_id', schoolId); 
      if (assignError) throw new Error(`Error assigning selected students: ${assignError.message}`);
    }

    revalidatePath('/class-management');
    revalidatePath('/admin/manage-students'); 
    return { ok: true, message: 'Student assignments updated.' };

  } catch (error: any) {
    console.error("Error in assignStudentsToClassAction:", error);
    return { ok: false, message: error.message || 'An unexpected error occurred during student assignment.' };
  }
}

export async function assignTeacherToClassAction(classId: string, teacherId: string | undefined | null, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  const { error } = await supabaseAdmin
    .from('classes')
    .update({ teacher_id: teacherId }) // teacherId can be null to unassign
    .eq('id', classId)
    .eq('school_id', schoolId);
  
  if (error) {
    console.error("Error assigning teacher:", error);
    return { ok: false, message: `Failed to assign teacher: ${error.message}`};
  }

  revalidatePath('/class-management');
  return { ok: true, message: 'Teacher assignment updated.' };
}

    