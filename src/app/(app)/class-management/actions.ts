
'use server';

import { supabase } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// --- Class Name (Standard) Management ---
export async function addClassNameAction(name: string, schoolId: string) {
  if (!name.trim()) return { ok: false, message: 'Class Name cannot be empty.' };
  
  const { data: existing, error: fetchError } = await supabase
    .from('class_names')
    .select('id')
    .eq('name', name.trim())
    .eq('school_id', schoolId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') return { ok: false, message: 'Database error checking name.' };
  if (existing) return { ok: false, message: `Class Name '${name.trim()}' already exists.` };

  const { error } = await supabase.from('class_names').insert({ name: name.trim(), school_id: schoolId });
  if (error) return { ok: false, message: `Failed to add class name: ${error.message}` };
  
  revalidatePath('/class-management');
  return { ok: true, message: `Class Name '${name.trim()}' added.` };
}

export async function deleteClassNameAction(id: string, schoolId: string) {
  // Check if used in active classes
  const { count, error: depError } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('class_name_id', id)
    .eq('school_id', schoolId);
  
  if (depError) return { ok: false, message: `Error checking dependencies: ${depError.message}`};
  if (count && count > 0) return { ok: false, message: `Cannot delete: Class Name is used in ${count} active class-section(s).`};

  const { error } = await supabase.from('class_names').delete().eq('id', id).eq('school_id', schoolId);
  if (error) return { ok: false, message: `Failed to delete class name: ${error.message}` };

  revalidatePath('/class-management');
  return { ok: true, message: 'Class Name deleted.' };
}

// --- Section/Division Name Management ---
export async function addSectionNameAction(name: string, schoolId: string) {
  if (!name.trim()) return { ok: false, message: 'Section Name cannot be empty.' };

  const { data: existing, error: fetchError } = await supabase
    .from('section_names')
    .select('id')
    .eq('name', name.trim())
    .eq('school_id', schoolId)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') return { ok: false, message: 'Database error checking name.' };
  if (existing) return { ok: false, message: `Section Name '${name.trim()}' already exists.` };

  const { error } = await supabase.from('section_names').insert({ name: name.trim(), school_id: schoolId });
  if (error) return { ok: false, message: `Failed to add section name: ${error.message}` };

  revalidatePath('/class-management');
  return { ok: true, message: `Section Name '${name.trim()}' added.` };
}

export async function deleteSectionNameAction(id: string, schoolId: string) {
  const { count, error: depError } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('section_name_id', id)
    .eq('school_id', schoolId);
  
  if (depError) return { ok: false, message: `Error checking dependencies: ${depError.message}`};
  if (count && count > 0) return { ok: false, message: `Cannot delete: Section Name is used in ${count} active class-section(s).`};

  const { error } = await supabase.from('section_names').delete().eq('id', id).eq('school_id', schoolId);
  if (error) return { ok: false, message: `Failed to delete section name: ${error.message}` };
  
  revalidatePath('/class-management');
  return { ok: true, message: 'Section Name deleted.' };
}


// --- Activate & Manage Class-Sections ---
interface ActivateClassSectionInput {
  classNameId: string;
  sectionNameId: string;
  schoolId: string;
  className: string; // denormalized
  sectionName: string; // denormalized
  academicYearId?: string;
}
export async function activateClassSectionAction(input: ActivateClassSectionInput) {
  const { classNameId, sectionNameId, schoolId, className, sectionName, academicYearId } = input;

  const { data: existing, error: fetchError } = await supabase
    .from('classes')
    .select('id')
    .eq('class_name_id', classNameId)
    .eq('section_name_id', sectionNameId)
    .eq('school_id', schoolId)
    .eq(academicYearId ? 'academic_year_id' : 'academic_year_id', academicYearId || null) // Handle null academicYearId
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') return { ok: false, message: `Database error: ${fetchError.message}` };
  if (existing) return { ok: false, message: `Class-Section '${className} - ${sectionName}' is already active${academicYearId ? ' for this academic year' : ''}.` };

  const { error: insertError } = await supabase
    .from('classes')
    .insert({ 
      class_name_id: classNameId, 
      section_name_id: sectionNameId, 
      school_id: schoolId, 
      name: className, 
      division: sectionName,
      academic_year_id: academicYearId || null 
    });

  if (insertError) return { ok: false, message: `Failed to activate class-section: ${insertError.message}` };
  
  revalidatePath('/class-management');
  return { ok: true, message: `Class-Section '${className} - ${sectionName}' activated.` };
}

export async function deleteActiveClassAction(activeClassId: string, schoolId: string) {
  // Unassign students first (set their class_id to null)
  const { error: studentUpdateError } = await supabase
    .from('students')
    .update({ class_id: null })
    .eq('class_id', activeClassId)
    .eq('school_id', schoolId);
  if (studentUpdateError) return { ok: false, message: `Failed to unassign students: ${studentUpdateError.message}`};

  const { error } = await supabase.from('classes').delete().eq('id', activeClassId).eq('school_id', schoolId);
  if (error) return { ok: false, message: `Failed to delete active class-section: ${error.message}` };

  revalidatePath('/class-management');
  return { ok: true, message: 'Active Class-Section deleted and students unassigned.' };
}

export async function assignStudentsToClassAction(classId: string, studentIds: string[], schoolId: string) {
  // Atomicity is tricky here without transactions in simple Supabase calls.
  // 1. Unassign ALL students currently in this class FOR THIS SCHOOL (if any)
  // This is a simplification. A more robust way might be to find students *removed* from the list.
  const { error: unassignError } = await supabase
    .from('students')
    .update({ class_id: null })
    .eq('class_id', classId)
    .eq('school_id', schoolId);
  if (unassignError) return { ok: false, message: `Error unassigning existing students: ${unassignError.message}`};

  // 2. Assign selected students to this class
  if (studentIds.length > 0) {
    const { error: assignError } = await supabase
      .from('students')
      .update({ class_id: classId })
      .in('id', studentIds)
      .eq('school_id', schoolId); 
    if (assignError) return { ok: false, message: `Error assigning selected students: ${assignError.message}`};
  }

  revalidatePath('/class-management');
  revalidatePath('/admin/manage-students'); // If student list shows class
  return { ok: true, message: 'Student assignments updated.' };
}

export async function assignTeacherToClassAction(classId: string, teacherId: string | undefined, schoolId: string) {
  const { error } = await supabase
    .from('classes')
    .update({ teacher_id: teacherId }) // teacherId can be null to unassign
    .eq('id', classId)
    .eq('school_id', schoolId);
  
  if (error) return { ok: false, message: `Failed to assign teacher: ${error.message}`};

  revalidatePath('/class-management');
  return { ok: true, message: 'Teacher assignment updated.' };
}

