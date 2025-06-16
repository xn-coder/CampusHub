
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType, Student, Teacher } from '@/types';

// --- Course Management ---
interface CourseInput {
  title: string;
  description?: string;
  is_paid: boolean;
  price?: number;
  school_id?: string; // Optional: for school-specific courses
}

export async function createCourseAction(
  input: CourseInput
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const courseId = uuidv4();
  
  const insertData = {
    ...input,
    id: courseId,
    price: input.is_paid ? input.price : null, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
  revalidatePath('/lms/available-courses');
  return { ok: true, message: 'Course created successfully.', course: data as Course };
}

export async function updateCourseAction(
  id: string,
  input: Partial<CourseInput>
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
   const updateData = {
    ...input,
    price: input.is_paid ? input.price : null,
    updated_at: new Date().toISOString(),
  };
  const { error, data } = await supabaseAdmin
    .from('lms_courses')
    .update(updateData)
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
  revalidatePath(`/lms/courses/${id}`);
  revalidatePath('/lms/available-courses');
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
  revalidatePath('/lms/available-courses');
  return { ok: true, message: 'Course and related data deleted successfully.' };
}

// --- Course Resource Management ---
interface CourseResourceInput {
  course_id: string;
  title: string;
  type: CourseResourceType;
  url_or_content: string;
}

export async function getCourseResourcesAction(courseId: string): Promise<{ok: boolean; resources?: CourseResource[]; message?: string}> {
    const supabaseAdmin = createSupabaseServerClient();
    if (!courseId) {
        return { ok: false, message: "Course ID is required."};
    }
    const { data, error } = await supabaseAdmin
        .from('lms_course_resources')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching course resources via action:", error);
        return { ok: false, message: `Failed to fetch resources: ${error.message}` };
    }
    return { ok: true, resources: data || [] };
}


export async function addCourseResourceAction(
  input: CourseResourceInput
): Promise<{ ok: boolean; message: string; resource?: CourseResource }> {
  const supabaseAdmin = createSupabaseServerClient();
  const resourceId = uuidv4();
  const { error, data } = await supabaseAdmin
    .from('lms_course_resources')
    .insert({ ...input, id: resourceId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error("Error adding course resource:", error);
    return { ok: false, message: `Failed to add resource: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${input.course_id}/content`);
  revalidatePath(`/lms/courses/${input.course_id}`);
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
  revalidatePath(`/lms/courses/${courseId}`);
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
    const uniqueCode = `CRS-${course_id.substring(0, 4).toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}-${uuidv4().substring(9, 13).toUpperCase()}`;
    newCodes.push({
      id: uuidv4(),
      course_id,
      code: uniqueCode,
      is_used: false,
      generated_date: currentDate.toISOString(),
      expiry_date: expiryDate,
      school_id: school_id || null, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    displayableCodes.push(uniqueCode);
  }

  const { error } = await supabaseAdmin.from('lms_course_activation_codes').insert(newCodes);

  if (error) {
    console.error("Error generating activation codes:", error);
    return { ok: false, message: `Failed to generate codes: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/activation-codes`); 
  return { ok: true, message: `${num_codes} activation code(s) generated.`, generatedCodes: displayableCodes };
}


// --- Enrollment Management ---
interface ManageEnrollmentInput {
  course_id: string;
  user_profile_id: string; // This is students.id or teachers.id
  user_type: 'student' | 'teacher';
  school_id: string; 
}

export async function enrollUserInCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type, school_id } = input; 

  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const fkColumnNameInEnrollmentTable = user_type === 'student' ? 'student_id' : 'teacher_id';
  // For students, user_profile_id is students.id. For teachers, user_profile_id is teachers.id.
  // This value will be directly used for student_id or teacher_id column.

  // Check for existing enrollment
  let existingEnrollmentCheckQuery = supabaseAdmin
    .from(enrollmentTable)
    .select('id')
    .eq(fkColumnNameInEnrollmentTable, user_profile_id)
    .eq('course_id', course_id);

  if (user_type === 'student') {
    // Student enrollments are additionally scoped by school_id in the enrollment table itself.
    existingEnrollmentCheckQuery = existingEnrollmentCheckQuery.eq('school_id', school_id);
  }
  
  const { data: existingEnrollment, error: fetchError } = await existingEnrollmentCheckQuery.single();
  
  if (fetchError && fetchError.code !== 'PGRST116') { 
    console.error(`Error checking existing enrollment for ${user_type}:`, fetchError);
    return { ok: false, message: `Database error checking enrollment: ${fetchError.message}` };
  }
  if (existingEnrollment) {
    return { ok: false, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} is already enrolled in this course.` };
  }
  
  // Prepare enrollment data
  const enrollmentData: any = { 
      id: uuidv4(), 
      course_id, 
  };
  enrollmentData[fkColumnNameInEnrollmentTable] = user_profile_id;

  if (user_type === 'student') {
    enrollmentData.school_id = school_id; 
    enrollmentData.enrolled_at = new Date().toISOString();
    // Assuming created_at and updated_at for lms_student_course_enrollments are handled by DB defaults or are not strictly required here
  } else { // teacher
    enrollmentData.assigned_at = new Date().toISOString();
    // school_id is not part of lms_teacher_course_enrollments
    // created_at/updated_at not part of lms_teacher_course_enrollments
  }

  const { error } = await supabaseAdmin.from(enrollmentTable).insert(enrollmentData);

  if (error) {
    console.error(`Error enrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to enroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  revalidatePath(`/lms/courses/${course_id}`);
  revalidatePath('/lms/available-courses');
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} enrolled successfully.` };
}

export async function unenrollUserFromCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type, school_id } = input;

  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const fkColumnNameInEnrollmentTable = user_type === 'student' ? 'student_id' : 'teacher_id';
  
  let deleteQuery = supabaseAdmin
    .from(enrollmentTable)
    .delete()
    .eq(fkColumnNameInEnrollmentTable, user_profile_id)
    .eq('course_id', course_id);

  if (user_type === 'student') {
    deleteQuery = deleteQuery.eq('school_id', school_id);
  }
  
  const { error } = await deleteQuery;

  if (error) {
    console.error(`Error unenrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to unenroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  revalidatePath(`/lms/courses/${course_id}`);
  revalidatePath('/lms/available-courses');
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} unenrolled successfully.` };
}

// --- Fetching Enrolled Users ---
export async function getEnrolledStudentsForCourseAction(
  courseId: string
): Promise<{ ok: boolean; students?: Student[]; message?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  // Fetch student_ids from enrollments
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('lms_student_course_enrollments')
    .select('student_id') // Select student_id from enrollments table
    .eq('course_id', courseId);

  if (enrollmentError) {
    console.error("Error fetching student enrollments:", enrollmentError);
    return { ok: false, message: `Failed to fetch student enrollments: ${enrollmentError.message}` };
  }

  if (!enrollments || enrollments.length === 0) {
    return { ok: true, students: [] };
  }

  const studentIdsFromEnrollments = enrollments.map(e => e.student_id).filter(id => id); // Ensure no null/undefined IDs
  if (studentIdsFromEnrollments.length === 0) {
    return { ok: true, students: [] };
  }
  
  // Fetch student details from students table using the student_ids obtained
  const { data: studentsData, error: studentsError } = await supabaseAdmin
    .from('students') 
    .select('*') 
    .in('id', studentIdsFromEnrollments); // Match by students.id

  if (studentsError) {
    console.error("Error fetching student details:", studentsError);
    return { ok: false, message: `Failed to fetch student details: ${studentsError.message}` };
  }

  return { ok: true, students: (studentsData as Student[]) || [] };
}

export async function getEnrolledTeachersForCourseAction(
  courseId: string
): Promise<{ ok: boolean; teachers?: Teacher[]; message?: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  // Fetch teacher_ids from enrollments
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('lms_teacher_course_enrollments')
    .select('teacher_id') 
    .eq('course_id', courseId);

  if (enrollmentError) {
    console.error("Error fetching teacher enrollments:", enrollmentError);
    return { ok: false, message: `Failed to fetch teacher enrollments: ${enrollmentError.message}` };
  }

  if (!enrollments || enrollments.length === 0) {
    return { ok: true, teachers: [] };
  }

  const teacherIds = enrollments.map(e => e.teacher_id).filter(id => id);
  if (teacherIds.length === 0) {
    return { ok: true, teachers: [] };
  }

  // Fetch teacher details from teachers table using the teacher_ids obtained
  const { data: teachersData, error: teachersError } = await supabaseAdmin
    .from('teachers')
    .select('*') 
    .in('id', teacherIds); // teachers.id is the teacher_profile_id

  if (teachersError) {
    console.error("Error fetching teacher details:", teachersError);
    return { ok: false, message: `Failed to fetch teacher details: ${teachersError.message}` };
  }

  return { ok: true, teachers: (teachersData as Teacher[]) || [] };
}
    

    