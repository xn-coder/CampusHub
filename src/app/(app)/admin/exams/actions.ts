
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Exam, Subject, ClassData, AcademicYear } from '@/types';

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
      supabaseAdmin.from('exams').select('*').eq('school_id', schoolId).order('date', { ascending: false }),
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
  subject_id: string;
  class_id?: string | null; 
  academic_year_id?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  max_marks?: number | null;
  school_id: string;
}

export async function addExamAction(
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examId = uuidv4();
  
  const examData = {
    ...input,
    id: examId,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };

  const { error, data } = await supabaseAdmin
    .from('exams')
    .insert(examData)
    .select()
    .single();

  if (error) {
    console.error("Error adding exam:", error);
    return { ok: false, message: `Failed to add exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam scheduled successfully.', exam: data as Exam };
}

export async function updateExamAction(
  id: string,
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examData = {
    ...input,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };
  // school_id is not updated, it's part of the query scope.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { school_id, ...updatePayload } = examData;


  const { error, data } = await supabaseAdmin
    .from('exams')
    .update(updatePayload)
    .eq('id', id)
    .eq('school_id', input.school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating exam:", error);
    return { ok: false, message: `Failed to update exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam updated successfully.', exam: data as Exam };
}

export async function deleteExamAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  // Check for dependencies (e.g., student_scores)
  const { count, error: depError } = await supabaseAdmin
    .from('student_scores')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', id)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking exam dependencies (student_scores):", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete exam: It has ${count} student score(s) associated with it.` };
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { ok: false, message: `Failed to delete exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  return { ok: true, message: 'Exam deleted successfully.' };
}
    