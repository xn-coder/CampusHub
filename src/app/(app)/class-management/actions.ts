
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ClassNameRecord, SectionRecord, ClassData, Student, Subject } from '@/types';

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
  
  const { data: classesData, error: classesError } = await supabaseAdmin
    .from('classes')
    .select(`
      *,
      class_subjects ( count )
    `)
    .eq('school_id', schoolId)
    .order('name')
    .order('division');

  if (classesError) {
    console.error("Error fetching active classes:", classesError);
    return { ok: false, message: `Database error: ${classesError.message}` };
  }
  
  const formattedClasses = (classesData || []).map(ac => ({
      ...ac,
      subjects_count: ac.class_subjects[0]?.count || 0, // Extract count
      studentIds: [] // studentIds will be populated on the client if needed
  } as ClassData));
  
  return { ok: true, activeClasses: formattedClasses };
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

export async function promoteStudentsToNewClassAction(studentIds: string[], destinationClassId: string, schoolId: string): Promise<{ ok: boolean; message: string; promotedCount: number }> {
    if (!studentIds || studentIds.length === 0) {
        return { ok: true, message: "No students selected for promotion.", promotedCount: 0 };
    }
    const supabaseAdmin = createSupabaseServerClient();
    
    const { error, count } = await supabaseAdmin
        .from('students')
        .update({ class_id: destinationClassId })
        .in('id', studentIds)
        .eq('school_id', schoolId);

    if (error) {
        return { ok: false, message: `Failed to promote students: ${error.message}`, promotedCount: 0 };
    }

    revalidatePath('/class-management');
    revalidatePath('/admin/manage-students');
    return { ok: true, message: `Successfully promoted ${count || 0} student(s) to the new class.`, promotedCount: count || 0 };
}

export async function getStudentsWithStatusForPromotionAction(classId: string, schoolId: string): Promise<{
    ok: boolean;
    studentsWithStatus?: (Student & { promotionStatus: 'Pass' | 'Fail' | 'Incomplete' })[];
    message?: string;
}> {
    const supabase = createSupabaseServerClient();

    try {
        // 1. Get all students in the class
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', classId)
            .eq('school_id', schoolId);
        if (studentsError) throw new Error(`Failed to fetch students: ${studentsError.message}`);
        if (!students || students.length === 0) return { ok: true, studentsWithStatus: [] };

        // 2. Find the most recent "End Term" exam relevant to this class
        const { data: endTermExams, error: examsError } = await supabase
            .from('exams')
            .select('*')
            .eq('school_id', schoolId)
            .like('name', '%End Term%')
            .or(`class_id.eq.${classId},class_id.is.null`)
            .order('date', { ascending: false });

        if (examsError) throw new Error(`Failed to fetch exams: ${examsError.message}`);
        if (!endTermExams || endTermExams.length === 0) {
            const studentsWithStatus = students.map(s => ({ ...s, promotionStatus: 'Incomplete' as const }));
            return { ok: true, studentsWithStatus, message: "No 'End Term' exam found to determine promotion status." };
        }

        // 3. Group the exams by date to find the latest exam event
        const latestExamDate = endTermExams[0].date;
        const latestExamGroup = endTermExams.filter(e => e.date === latestExamDate);
        const latestExamIds = latestExamGroup.map(e => e.id);
        const subjectsInExam = latestExamGroup.map(e => e.subject_id);

        // 4. Fetch scores for these students for the latest end term exam
        const studentIds = students.map(s => s.id);
        const { data: scores, error: scoresError } = await supabase
            .from('student_scores')
            .select('student_id, score, max_marks, subject_id')
            .in('student_id', studentIds)
            .in('exam_id', latestExamIds);

        if (scoresError) throw new Error(`Failed to fetch scores: ${scoresError.message}`);

        // 5. Determine promotion status for each student
        const studentsWithStatus = students.map(student => {
            const studentScores = scores?.filter(s => s.student_id === student.id) || [];
            
            // Check if student has scores for all subjects in the exam
            const hasAllScores = subjectsInExam.every(subjId => studentScores.some(s => s.subject_id === subjId));
            if (!hasAllScores) {
                return { ...student, promotionStatus: 'Incomplete' as const };
            }

            // Check if any score is failing
            const hasFailed = studentScores.some(s => {
                const maxMarks = s.max_marks || 100;
                const passMarks = maxMarks * 0.4; // 40% passing
                return Number(s.score) < passMarks;
            });

            return {
                ...student,
                promotionStatus: hasFailed ? ('Fail' as const) : ('Pass' as const)
            };
        });

        return { ok: true, studentsWithStatus };

    } catch (error: any) {
        return { ok: false, message: error.message };
    }
}
    
// --- Subject Assignment ---

export async function getAssignedSubjectsForClassAction(classId: string, schoolId: string): Promise<{ ok: boolean; subjectIds?: string[]; message?: string }> {
  if (!classId || !schoolId) {
    return { ok: false, message: "Class ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('class_subjects')
    .select('subject_id')
    .eq('class_id', classId)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error fetching assigned subjects for class:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  return { ok: true, subjectIds: data.map(item => item.subject_id) };
}

export async function saveClassSubjectAssignmentsAction(
  classId: string,
  subjectIds: string[],
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!classId || !schoolId) {
    return { ok: false, message: "Class ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    // Start a transaction
    await supabase.rpc('run_as_transaction', {});

    // Delete existing assignments for this class
    const { error: deleteError } = await supabase
      .from('class_subjects')
      .delete()
      .eq('class_id', classId);

    if (deleteError) {
      throw new Error(`Failed to clear existing subject assignments: ${deleteError.message}`);
    }

    // Insert new assignments if any are selected
    if (subjectIds.length > 0) {
      const newAssignments = subjectIds.map(subjectId => ({
        class_id: classId,
        subject_id: subjectId,
        school_id: schoolId,
      }));
      const { error: insertError } = await supabase
        .from('class_subjects')
        .insert(newAssignments);
      
      if (insertError) {
        throw new Error(`Failed to assign new subjects: ${insertError.message}`);
      }
    }

    revalidatePath('/class-management');
    return { ok: true, message: 'Subject assignments have been updated successfully.' };

  } catch (error: any) {
    console.error("Error in saveClassSubjectAssignmentsAction:", error);
    return { ok: false, message: error.message || 'An unexpected error occurred during subject assignment.' };
  }
}
