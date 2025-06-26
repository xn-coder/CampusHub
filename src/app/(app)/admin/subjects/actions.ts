
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Subject, AcademicYear } from '@/types';

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

export async function getSubjectsPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  subjects?: Subject[];
  academicYears?: AcademicYear[];
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [subjectsRes, academicYearsRes] = await Promise.all([
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);

    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);

    return {
      ok: true,
      schoolId,
      subjects: subjectsRes.data || [],
      academicYears: academicYearsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getSubjectsPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

interface SubjectInput {
  name: string;
  code: string;
  academic_year_id?: string | null;
  school_id: string;
}

export async function addSubjectAction(
  input: SubjectInput
): Promise<{ ok: boolean; message: string; subject?: Subject }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { name, code, academic_year_id, school_id } = input;

  // Check for uniqueness of code within the school
  const { data: existingCode, error: codeCheckError } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('code', code.trim())
    .eq('school_id', school_id)
    .maybeSingle();

  if (codeCheckError) {
    console.error("Error checking subject code uniqueness:", codeCheckError);
    return { ok: false, message: `Database error: ${codeCheckError.message}` };
  }
  if (existingCode) {
    return { ok: false, message: `Subject code "${code.trim()}" already exists in this school.` };
  }
  
  const subjectId = uuidv4();
  const { error, data } = await supabaseAdmin
    .from('subjects')
    .insert({
      id: subjectId,
      name: name.trim(),
      code: code.trim(),
      academic_year_id: academic_year_id === 'none_ay_selection' || !academic_year_id ? null : academic_year_id,
      school_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding subject:", error);
    return { ok: false, message: `Failed to add subject: ${error.message}` };
  }
  revalidatePath('/admin/subjects');
  revalidatePath('/teacher/student-scores');
  return { ok: true, message: 'Subject added successfully.', subject: data as Subject };
}

export async function updateSubjectAction(
  id: string,
  input: SubjectInput
): Promise<{ ok: boolean; message: string; subject?: Subject }> {
  const supabaseAdmin = createSupabaseServerClient();
   const { name, code, academic_year_id, school_id } = input;

  // Check for uniqueness of code within the school, excluding the current subject
  const { data: existingCode, error: codeCheckError } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('code', code.trim())
    .eq('school_id', school_id)
    .neq('id', id)
    .maybeSingle();
    
  if (codeCheckError) {
    console.error("Error checking subject code uniqueness on update:", codeCheckError);
    return { ok: false, message: `Database error: ${codeCheckError.message}` };
  }
  if (existingCode) {
    return { ok: false, message: `Another subject with code "${code.trim()}" already exists in this school.` };
  }

  const { error, data } = await supabaseAdmin
    .from('subjects')
    .update({
      name: name.trim(),
      code: code.trim(),
      academic_year_id: academic_year_id === 'none_ay_selection' || !academic_year_id ? null : academic_year_id,
    })
    .eq('id', id)
    .eq('school_id', school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating subject:", error);
    return { ok: false, message: `Failed to update subject: ${error.message}` };
  }
  revalidatePath('/admin/subjects');
  revalidatePath('/teacher/student-scores');
  return { ok: true, message: 'Subject updated successfully.', subject: data as Subject };
}

export async function deleteSubjectAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // Basic dependency check (e.g., exams)
  const { count: examCount, error: examDepError } = await supabaseAdmin
    .from('exams')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', id)
    .eq('school_id', schoolId);

  if (examDepError) {
    console.error("Error checking subject dependencies (exams):", examDepError);
    return { ok: false, message: `Error checking dependencies: ${examDepError.message}` };
  }
  if (examCount && examCount > 0) {
    return { ok: false, message: `Cannot delete subject: It is used in ${examCount} exam(s).` };
  }
  
  // Add more dependency checks as needed (e.g., assignments, class schedules)

  const { error } = await supabaseAdmin
    .from('subjects')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting subject:", error);
    return { ok: false, message: `Failed to delete subject: ${error.message}` };
  }
  revalidatePath('/admin/subjects');
  revalidatePath('/teacher/student-scores');
  return { ok: true, message: 'Subject deleted successfully.' };
}
    