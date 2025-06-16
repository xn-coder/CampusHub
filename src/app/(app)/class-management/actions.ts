
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ClassNameRecord, SectionRecord, ClassData } from '@/types';

// --- Class Name (Standard) Management ---

export async function getClassNamesAction(schoolId: string): Promise<{ ok: boolean; message?: string; classNames?: ClassNameRecord[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required to fetch class names." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data, error } = await supabaseAdmin
    .from('class_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error("Error fetching class names:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  return { ok: true, classNames: data || [] };
}

export async function addClassNameAction(name: string, schoolId: string): Promise<{ ok: boolean; message: string; classNames?: ClassNameRecord[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  let message = '';
  let ok = false;

  if (!name.trim()) {
    message = 'Class Name cannot be empty.';
  } else {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('class_names')
      .select('id')
      .eq('name', name.trim())
      .eq('school_id', schoolId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
      console.error("Error checking class name:", fetchError);
      message = 'Database error checking name.';
    } else if (existing) {
      message = `Class Name '${name.trim()}' already exists.`;
    } else {
      const { error: insertError } = await supabaseAdmin.from('class_names').insert({ name: name.trim(), school_id: schoolId, id: uuidv4() });
      if (insertError) {
        console.error("Error adding class name:", insertError);
        message = `Failed to add class name: ${insertError.message}`;
      } else {
        ok = true;
        message = `Class Name '${name.trim()}' added.`;
        revalidatePath('/class-management');
      }
    }
  }

  const { data: currentClassNames, error: listFetchError } = await supabaseAdmin
    .from('class_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (listFetchError) {
    console.error("Error fetching current class names list after add attempt:", listFetchError);
    // If ok was true, but list fetch failed, it's still a partial success but data might be stale on client
    return { ok: false, message: message || "Error fetching updated class names list.", classNames: [] };
  }

  return { ok, message, classNames: currentClassNames || [] };
}

export async function updateClassNameAction(id: string, newName: string, schoolId: string): Promise<{ ok: boolean; message: string; classNames?: ClassNameRecord[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  let message = '';
  let ok = false;

  if (!newName.trim()) {
    message = 'New Class Name cannot be empty.';
  } else {
    const { data: conflicting, error: fetchError } = await supabaseAdmin
      .from('class_names')
      .select('id')
      .eq('name', newName.trim())
      .eq('school_id', schoolId)
      .neq('id', id) // Exclude the current item being updated
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking for conflicting class name:", fetchError);
      message = 'Database error checking for name conflict.';
    } else if (conflicting) {
      message = `Another Class Name '${newName.trim()}' already exists.`;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('class_names')
        .update({ name: newName.trim() })
        .eq('id', id)
        .eq('school_id', schoolId);

      if (updateError) {
        console.error("Error updating class name:", updateError);
        message = `Failed to update class name: ${updateError.message}`;
      } else {
        ok = true;
        message = `Class Name updated to '${newName.trim()}'.`;
        revalidatePath('/class-management');
      }
    }
  }

  const { data: currentClassNames, error: listFetchError } = await supabaseAdmin
    .from('class_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');
  
  if (listFetchError) {
     console.error("Error fetching current class names list after update attempt:", listFetchError);
     return { ok: false, message: message || "Error fetching updated class names list.", classNames: [] };
  }

  return { ok, message, classNames: currentClassNames || [] };
}


export async function deleteClassNameAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string; classNames?: ClassNameRecord[] }> {
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
  const { data: currentClassNames, error: listFetchError } = await supabaseAdmin
    .from('class_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');
  
  if (listFetchError) {
     console.error("Error fetching current class names list after delete:", listFetchError);
     return { ok: true, message: 'Class Name deleted, but failed to fetch updated list.', classNames: [] };
  }
  return { ok: true, message: 'Class Name deleted.', classNames: currentClassNames || [] };
}

// --- Section/Division Name Management ---

export async function getSectionNamesAction(schoolId: string): Promise<{ ok: boolean; message?: string; sectionNames?: SectionRecord[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required to fetch section names." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data, error } = await supabaseAdmin
    .from('section_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    console.error("Error fetching section names:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  return { ok: true, sectionNames: data || [] };
}


export async function addSectionNameAction(name: string, schoolId: string): Promise<{ ok: boolean; message: string; sectionNames?: SectionRecord[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  let message = '';
  let ok = false;

  if (!name.trim()) {
    message = 'Section Name cannot be empty.';
  } else {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('section_names')
      .select('id')
      .eq('name', name.trim())
      .eq('school_id', schoolId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { 
      console.error("Error checking section name:", fetchError);
      message = 'Database error checking name.';
    } else if (existing) {
      message = `Section Name '${name.trim()}' already exists.`;
    } else {
      const { error: insertError } = await supabaseAdmin.from('section_names').insert({ name: name.trim(), school_id: schoolId, id: uuidv4() });
      if (insertError) {
        console.error("Error adding section name:", insertError);
        message = `Failed to add section name: ${insertError.message}`;
      } else {
        ok = true;
        message = `Section Name '${name.trim()}' added.`;
        revalidatePath('/class-management');
      }
    }
  }

  const { data: currentSectionNames, error: listFetchError } = await supabaseAdmin
    .from('section_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (listFetchError) {
    console.error("Error fetching current section names list after add attempt:", listFetchError);
    return { ok: false, message: message || "Error fetching updated section names list.", sectionNames: [] };
  }
  
  return { ok, message, sectionNames: currentSectionNames || [] };
}

export async function updateSectionNameAction(id: string, newName: string, schoolId: string): Promise<{ ok: boolean; message: string; sectionNames?: SectionRecord[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  let message = '';
  let ok = false;

  if (!newName.trim()) {
    message = 'New Section Name cannot be empty.';
  } else {
    const { data: conflicting, error: fetchError } = await supabaseAdmin
      .from('section_names')
      .select('id')
      .eq('name', newName.trim())
      .eq('school_id', schoolId)
      .neq('id', id) // Exclude the current item being updated
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking for conflicting section name:", fetchError);
      message = 'Database error checking for name conflict.';
    } else if (conflicting) {
      message = `Another Section Name '${newName.trim()}' already exists.`;
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('section_names')
        .update({ name: newName.trim() })
        .eq('id', id)
        .eq('school_id', schoolId);

      if (updateError) {
        console.error("Error updating section name:", updateError);
        message = `Failed to update section name: ${updateError.message}`;
      } else {
        ok = true;
        message = `Section Name updated to '${newName.trim()}'.`;
        revalidatePath('/class-management');
      }
    }
  }
  
  const { data: currentSectionNames, error: listFetchError } = await supabaseAdmin
    .from('section_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (listFetchError) {
     console.error("Error fetching current section names list after update attempt:", listFetchError);
     return { ok: false, message: message || "Error fetching updated section names list.", sectionNames: [] };
  }

  return { ok, message, sectionNames: currentSectionNames || [] };
}


export async function deleteSectionNameAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string; sectionNames?: SectionRecord[] }> {
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
  const { data: currentSectionNames, error: listFetchError } = await supabaseAdmin
    .from('section_names')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');

  if (listFetchError) {
     console.error("Error fetching current section names list after delete:", listFetchError);
     return { ok: true, message: 'Section Name deleted, but failed to fetch updated list.', sectionNames: [] };
  }
  return { ok: true, message: 'Section Name deleted.', sectionNames: currentSectionNames || [] };
}

// --- Activated Class-Section Management ---

export async function getActiveClassesAction(schoolId: string): Promise<{ ok: boolean; message?: string; activeClasses?: ClassData[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required to fetch active classes." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')
    .order('division');

  if (error) {
    console.error("Error fetching active classes:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  return { ok: true, activeClasses: (data || []).map(ac => ({...ac, studentIds: []} as ClassData)) };
}


interface ActivateClassSectionInput {
  classNameId: string;
  sectionNameId: string;
  schoolId: string;
  academicYearId?: string; 
}

export async function activateClassSectionAction(input: ActivateClassSectionInput) {
  const supabaseAdmin = createSupabaseServerClient();
  const { classNameId, sectionNameId, schoolId, academicYearId } = input;
  console.log('[Action] activateClassSectionAction input:', JSON.stringify(input, null, 2));

  if (!classNameId || !sectionNameId || !schoolId) {
    const missingFields = [];
    if (!classNameId) missingFields.push('classNameId');
    if (!sectionNameId) missingFields.push('sectionNameId');
    if (!schoolId) missingFields.push('schoolId');
    const errorMessage = `Missing required fields for class activation: ${missingFields.join(', ')}.`;
    console.error('[Action] Validation Error:', errorMessage);
    return { ok: false, message: errorMessage };
  }

  const { data: classNameRecord, error: cnError } = await supabaseAdmin
    .from('class_names')
    .select('name')
    .eq('id', classNameId)
    .eq('school_id', schoolId)
    .single();
  console.log('[Action] classNameRecord fetch result:', JSON.stringify(classNameRecord, null, 2), 'Error:', JSON.stringify(cnError, null, 2));
  if (cnError || !classNameRecord) {
    console.error("[Action] Error fetching class name definition:", cnError);
    return { ok: false, message: "Could not find the specified class name definition for this school." };
  }
  const actualClassName = classNameRecord.name;

  const { data: sectionNameRecord, error: snError } = await supabaseAdmin
    .from('section_names')
    .select('name')
    .eq('id', sectionNameId)
    .eq('school_id', schoolId)
    .single();
  console.log('[Action] sectionNameRecord fetch result:', JSON.stringify(sectionNameRecord, null, 2), 'Error:', JSON.stringify(snError, null, 2));
  if (snError || !sectionNameRecord) {
    console.error("[Action] Error fetching section name definition:", snError);
    return { ok: false, message: "Could not find the specified section name definition for this school." };
  }
  const actualSectionName = sectionNameRecord.name;
  
  let query = supabaseAdmin
    .from('classes')
    .select('id')
    .eq('class_name_id', classNameId)
    .eq('section_name_id', sectionNameId)
    .eq('school_id', schoolId);

  if (academicYearId && academicYearId !== 'none') {
    query = query.eq('academic_year_id', academicYearId);
  } else {
    query = query.is('academic_year_id', null);
  }
  
  const { data: existing, error: fetchError } = await query.single();
  console.log('[Action] Existing class-section check result:', JSON.stringify(existing, null, 2), 'Error:', JSON.stringify(fetchError, null, 2));

  if (fetchError && fetchError.code !== 'PGRST116') { 
    console.error("[Action] Database error checking for existing class-section:", fetchError);
    return { ok: false, message: `Database error: ${fetchError.message}` };
  }
  if (existing) {
    const forYear = academicYearId && academicYearId !== 'none' ? `for academic year ID ${academicYearId}` : '(general assignment)';
    const message = `Class-Section '${actualClassName} - ${actualSectionName}' is already active ${forYear}.`;
    console.log('[Action] Existing class-section found:', message);
    return { ok: false, message: message };
  }

  const newClassId = uuidv4();
  const payloadToInsert: any = {
    id: newClassId,
    class_name_id: classNameId,
    section_name_id: sectionNameId,
    school_id: schoolId,
    name: actualClassName, 
    division: actualSectionName, 
    academic_year_id: (academicYearId && academicYearId !== 'none') ? academicYearId : null,
  };
  
  console.log("[Action] Attempting to insert active class-section with payload:", JSON.stringify(payloadToInsert, null, 2));
  const { data: insertedData, error: insertError } = await supabaseAdmin
    .from('classes')
    .insert(payloadToInsert)
    .select() 
    .single(); 

  if (insertError) {
    console.error("[Action] Error activating class-section (inserting into DB):", insertError.message, "Details:", JSON.stringify(insertError, null, 2));
    return { ok: false, message: `Failed to activate class-section: ${insertError.message}` };
  }
  if (!insertedData) {
    console.error("[Action] Failed to activate class-section (no data returned after insert).");
    return { ok: false, message: "Failed to activate class-section (no data returned after insert)." };
  }
  
  console.log('[Action] Class-section activated successfully:', JSON.stringify(insertedData, null, 2));
  revalidatePath('/class-management');
  return { ok: true, message: `Class-Section '${actualClassName} - ${actualSectionName}' activated successfully.` };
}


export async function deleteActiveClassAction(activeClassId: string, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  
  const { error: studentUpdateError } = await supabaseAdmin
    .from('students')
    .update({ class_id: null })
    .eq('class_id', activeClassId)
    .eq('school_id', schoolId); 
  if (studentUpdateError) {
    console.error("Error unassigning students from class being deleted:", studentUpdateError);
    return { ok: false, message: `Failed to unassign students: ${studentUpdateError.message}. Class not deleted.`};
  }

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
    const { error: unassignError } = await supabaseAdmin
      .from('students')
      .update({ class_id: null })
      .eq('class_id', classId)
      .eq('school_id', schoolId);
    if (unassignError) throw new Error(`Error unassigning existing students: ${unassignError.message}`);

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
    return { ok: true, message: 'Student assignments updated for the class.' };

  } catch (error: any) {
    console.error("Error in assignStudentsToClassAction:", error);
    return { ok: false, message: error.message || 'An unexpected error occurred during student assignment.' };
  }
}


export async function assignTeacherToClassAction(classId: string, teacherId: string | undefined | null, schoolId: string) {
  const supabaseAdmin = createSupabaseServerClient();
  const { error } = await supabaseAdmin
    .from('classes')
    .update({ teacher_id: teacherId === 'unassign' || !teacherId ? null : teacherId }) 
    .eq('id', classId)
    .eq('school_id', schoolId);
  
  if (error) {
    console.error("Error assigning teacher:", error);
    return { ok: false, message: `Failed to assign teacher: ${error.message}`};
  }

  revalidatePath('/class-management');
  return { ok: true, message: 'Teacher assignment updated.' };
}
    
