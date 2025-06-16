
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType } from '@/types';

// --- Course Management ---
interface CourseInput {
  title: string;
  description?: string;
  is_paid: boolean;
  price?: number;
  school_id?: string; // Optional: for school-specific courses
  created_by_user_id: string;
}

export async function createCourseAction(
  input: CourseInput
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const courseId = uuidv4();
  
  // Ensure created_by_user_id is part of the object being inserted
  const insertData = {
    ...input,
    id: courseId,
    // created_by_user_id is already in input if CourseInput is correctly populated by caller
  };

  const { error, data } = await supabaseAdmin
    .from('lms_courses')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating course:", error);
    return { ok: false, message: `Failed to create course: ${error.message}` };
  }
  revalidatePath('/admin/lms/courses');
  return { ok: true, message: 'Course created successfully.', course: data as Course };
}

export async function updateCourseAction(
  id: string,
  input: Partial<CourseInput>
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { error, data } = await supabaseAdmin
    .from('lms_courses')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating course:", error);
    return { ok: false, message: `Failed to update course: ${error.message}` };
  }
  revalidatePath('/admin/lms/courses');
  revalidatePath(`/admin/lms/courses/${id}/content`);
  revalidatePath(`/admin/lms/courses/${id}/enrollments`);
  return { ok: true, message: 'Course updated successfully.', course: data as Course };
}

export async function deleteCourseAction(id: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  await supabaseAdmin.from('lms_course_resources').delete().eq('course_id', id);
  await supabaseAdmin.from('lms_course_activation_codes').delete().eq('course_id', id);
  await supabaseAdmin.from('lms_student_course_enrollments').delete().eq('course_id', id);
  await supabaseAdmin.from('lms_teacher_course_enrollments').delete().eq('course_id', id);

  const { error } = await supabaseAdmin.from('lms_courses').delete().eq('id', id);

  if (error) {
    console.error("Error deleting course:", error);
    return { ok: false, message: `Failed to delete course: ${error.message}` };
  }
  revalidatePath('/admin/lms/courses');
  return { ok: true, message: 'Course and related data deleted successfully.' };
}

// --- Course Resource Management ---
interface CourseResourceInput {
  course_id: string;
  title: string;
  type: CourseResourceType;
  url_or_content: string;
}

export async function addCourseResourceAction(
  input: CourseResourceInput
): Promise<{ ok: boolean; message: string; resource?: CourseResource }> {
  const supabaseAdmin = createSupabaseServerClient();
  const resourceId = uuidv4();
  const { error, data } = await supabaseAdmin
    .from('lms_course_resources')
    .insert({ ...input, id: resourceId })
    .select()
    .single();

  if (error) {
    console.error("Error adding course resource:", error);
    return { ok: false, message: `Failed to add resource: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${input.course_id}/content`);
  return { ok: true, message: 'Resource added successfully.', resource: data as CourseResource };
}

export async function deleteCourseResourceAction(id: string, courseId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { error } = await supabaseAdmin.from('lms_course_resources').delete().eq('id', id);

  if (error) {
    console.error("Error deleting course resource:", error);
    return { ok: false, message: `Failed to delete resource: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${courseId}/content`);
  return { ok: true, message: 'Resource deleted successfully.' };
}


// --- Activation Code Management ---
interface GenerateCodesInput {
  course_id: string;
  num_codes: number;
  expires_in_days: number;
  school_id?: string;
}

export async function generateActivationCodesAction(
  input: GenerateCodesInput
): Promise<{ ok: boolean; message: string; generatedCodes?: string[] }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, num_codes, expires_in_days, school_id } = input;
  const newCodes: Partial<CourseActivationCode>[] = [];
  const displayableCodes: string[] = [];
  const currentDate = new Date();
  
  let expiryDate: string | undefined = undefined;
  if (expires_in_days > 0) {
    const tempExpiryDate = new Date(currentDate);
    tempExpiryDate.setDate(currentDate.getDate() + expires_in_days);
    expiryDate = tempExpiryDate.toISOString();
  }


  for (let i = 0; i < num_codes; i++) {
    const uniqueCode = `CRS-${course_id.substring(0, 4)}-${uuidv4().substring(0, 8).toUpperCase()}`;
    newCodes.push({
      id: uuidv4(),
      course_id,
      code: uniqueCode,
      is_used: false,
      generated_date: currentDate.toISOString(),
      expiry_date: expiryDate,
      school_id: school_id || null, 
    });
    displayableCodes.push(uniqueCode);
  }

  const { error } = await supabaseAdmin.from('lms_course_activation_codes').insert(newCodes);

  if (error) {
    console.error("Error generating activation codes:", error);
    return { ok: false, message: `Failed to generate codes: ${error.message}` };
  }
  revalidatePath('/admin/lms/courses'); 
  return { ok: true, message: `${num_codes} activation code(s) generated.`, generatedCodes: displayableCodes };
}


// --- Enrollment Management ---
interface ManageEnrollmentInput {
  course_id: string;
  user_profile_id: string; 
  user_type: 'student' | 'teacher';
  school_id: string; 
}

export async function enrollUserInCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type, school_id } = input;
  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const userIdColumn = user_type === 'student' ? 'student_id' : 'teacher_id';
  const enrolledAtColumn = user_type === 'student' ? 'enrolled_at' : 'assigned_at';

  const { data: existingEnrollment, error: fetchError } = await supabaseAdmin
    .from(enrollmentTable)
    .select('id')
    .eq(userIdColumn, user_profile_id)
    .eq('course_id', course_id)
    .eq('school_id', school_id)
    .single();
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error(`Error checking existing enrollment for ${user_type}:`, fetchError);
    return { ok: false, message: `Database error checking enrollment: ${fetchError.message}` };
  }
  if (existingEnrollment) {
    return { ok: false, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} is already enrolled.` };
  }
  
  const enrollmentData: any = { id: uuidv4(), course_id, school_id };
  enrollmentData[userIdColumn] = user_profile_id;
  enrollmentData[enrolledAtColumn] = new Date().toISOString();


  const { error } = await supabaseAdmin.from(enrollmentTable).insert(enrollmentData);

  if (error) {
    console.error(`Error enrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to enroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} enrolled successfully.` };
}

export async function unenrollUserFromCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type, school_id } = input;
  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const userIdColumn = user_type === 'student' ? 'student_id' : 'teacher_id';

  const { error } = await supabaseAdmin
    .from(enrollmentTable)
    .delete()
    .eq(userIdColumn, user_profile_id)
    .eq('course_id', course_id)
    .eq('school_id', school_id);

  if (error) {
    console.error(`Error unenrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to unenroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} unenrolled successfully.` };
}
    
