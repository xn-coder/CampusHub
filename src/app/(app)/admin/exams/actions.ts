
'use server';

console.log('[LOG] Loading src/app/(app)/admin/exams/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Exam, Subject, ClassData, AcademicYear, UserRole } from '@/types';

async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolId: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export async function getExamsPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  exams?: Exam[];
  subjects?: Subject[];
  activeClasses?: ClassData[];
  academicYears?: AcademicYear[];
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [examsRes, subjectsRes, classesRes, academicYearsRes] = await Promise.all([
      supabaseAdmin.from('exams').select('*, class:class_id(name,division), subject:subject_id(name,code)').eq('school_id', schoolId).order('date', { ascending: false }),
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);

    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);

    return {
      ok: true,
      schoolId,
      exams: examsRes.data || [],
      subjects: subjectsRes.data || [],
      activeClasses: classesRes.data || [],
      academicYears: academicYearsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getExamsPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

interface ExamInput {
  name: string;
  class_id?: string | null; 
  academic_year_id?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  max_marks?: number | null;
  school_id: string;
  subject_id: string;
}

export async function addExamAction(
  inputs: ExamInput[]
): Promise<{ ok: boolean; message: string; savedCount: number, errorCount: number, errors: string[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  let savedCount = 0;
  let errorCount = 0;
  const errorMessages: string[] = [];

  const results = await Promise.allSettled(
    inputs.map(async (input) => {
      let query = supabaseAdmin
        .from('exams')
        .select('id')
        .eq('name', input.name)
        .eq('school_id', input.school_id)
        .eq('subject_id', input.subject_id);
      
      if (input.class_id) {
        query = query.eq('class_id', input.class_id);
      } else {
        query = query.is('class_id', null);
      }

      const { data: existingExam, error: checkError } = await query.maybeSingle();

      if (checkError) {
        throw new Error(`DB check failed for "${input.name}": ${checkError.message}`);
      }

      if (existingExam) {
        throw new Error(`Exam "${input.name}" for this subject/class already exists.`);
      }

      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('exams')
        .insert({ ...input, id: uuidv4() })
        .select()
        .single();
      
      if (insertError) {
        throw new Error(`Insert failed for "${input.name}": ${insertError.message}`);
      }
      return insertedData;
    })
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      savedCount++;
    } else {
      errorCount++;
      errorMessages.push(result.reason.message);
      console.error(`Error creating exam for input ${index}:`, result.reason);
    }
  });

  if (savedCount > 0) {
    revalidatePath('/admin/exams');
  }

  const message = `Successfully created ${savedCount} exam(s). Failed to create ${errorCount} exam(s). ${errorCount > 0 ? 'Errors: ' + errorMessages.join('; ') : ''}`;
  return { ok: errorCount === 0, message, savedCount, errorCount, errors: errorMessages };
}


export async function updateExamAction(
  id: string,
  input: Omit<ExamInput, 'subject_id'> & {subject_id?: string} // subject_id is not updatable
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  const { subject_id, school_id, ...updatePayload } = input;

  const { error, data } = await supabaseAdmin
    .from('exams')
    .update(updatePayload)
    .eq('id', id)
    .eq('school_id', school_id) // Scope update to school
    .select('*, class:class_id(name,division), subject:subject_id(name,code)')
    .single();

  if (error) {
    console.error("Error updating exam:", error);
    return { ok: false, message: `Failed to update exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam updated successfully.', exam: data as Exam };
}

export async function deleteExamAction(examIds: string[], schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  // Check for dependencies across all exams in the group
  const { count, error: depError } = await supabaseAdmin
    .from('student_scores')
    .select('id', { count: 'exact', head: true })
    .in('exam_id', examIds)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking exam dependencies (student_scores):", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete exam group: It has ${count} student score(s) associated with it.` };
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .in('id', examIds)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting exam group:", error);
    return { ok: false, message: `Failed to delete exam group: ${error.message}` };
  }
  
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam group deleted successfully.' };
}
