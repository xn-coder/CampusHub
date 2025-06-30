
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType, Student, Teacher, UserRole, CourseWithEnrollmentStatus } from '@/types';

// --- Course Management ---
interface CourseInput {
  title: string;
  description?: string;
  is_paid: boolean;
  price?: number;
  school_id?: string | null;
  target_audience: 'student' | 'teacher' | 'both';
  target_class_id?: string | null;
  created_by_user_id: string;
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

export async function addCourseFileResourceAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; resource?: CourseResource }> {
  const supabaseAdmin = createSupabaseServerClient();

  const file = formData.get('resourceFile') as File | null;
  const courseId = formData.get('courseId') as string | null;
  const title = formData.get('title') as string | null;
  const type = formData.get('type') as CourseResourceType | null;

  if (!file || !courseId || !title || !type) {
    return { ok: false, message: 'Missing required data for file resource.' };
  }
  
  if (!['ebook', 'video'].includes(type)) {
      return { ok: false, message: `File uploads are not supported for the '${type}' resource type.`};
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filePath = `public/courses/${courseId}/resources/${uuidv4()}-${sanitizedFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('campushub')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Supabase storage upload error for course resource:', uploadError);
    return { ok: false, message: `Failed to upload file: ${uploadError.message}` };
  }
  
  const { data: publicUrlData } = supabaseAdmin.storage
      .from('campushub')
      .getPublicUrl(filePath);

  if (!publicUrlData) {
      // Clean up orphaned file
      await supabaseAdmin.storage.from('campushub').remove([filePath]);
      return { ok: false, message: 'Could not retrieve public URL for the uploaded file.' };
  }

  const resourceId = uuidv4();
  const { error: dbError, data: resourceData } = await supabaseAdmin
    .from('lms_course_resources')
    .insert({ 
        id: resourceId,
        course_id: courseId, 
        title: title, 
        type: type, 
        url_or_content: publicUrlData.publicUrl,
        file_name: sanitizedFileName,
        file_path: filePath, // Store the path for deletion
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
    })
    .select()
    .single();

  if (dbError) {
    console.error('Error adding file course resource to DB:', dbError);
    // Clean up orphaned file
    await supabaseAdmin.storage.from('campushub').remove([filePath]);
    return { ok: false, message: `Failed to add resource record: ${dbError.message}` };
  }

  revalidatePath(`/admin/lms/courses/${courseId}/content`);
  revalidatePath(`/lms/courses/${courseId}`);
  return { ok: true, message: 'File resource added successfully.', resource: resourceData as CourseResource };
}


export async function deleteCourseResourceAction(id: string, courseId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  // First, get the resource to check if there's a file to delete from storage
  const { data: resourceToDelete, error: fetchError } = await supabaseAdmin
    .from('lms_course_resources')
    .select('file_path')
    .eq('id', id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "no rows found"
    console.error("Error fetching resource for deletion:", fetchError);
    return { ok: false, message: 'Could not retrieve resource to delete.' };
  }
  
  // Then, delete the resource from the database regardless of storage outcome
  const { error } = await supabaseAdmin.from('lms_course_resources').delete().eq('id', id);

  if (error) {
    console.error("Error deleting course resource:", error);
    return { ok: false, message: `Failed to delete resource record: ${error.message}` };
  }
  
  // If the DB record was deleted and there was a file path, try to delete the file from storage
  if (resourceToDelete?.file_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from('campushub')
      .remove([resourceToDelete.file_path]);
    
    if (storageError) {
        // Log a warning but don't fail the whole operation since the DB record is gone.
        console.warn(`Could not delete file from storage: ${storageError.message}. The database record was deleted successfully.`);
    }
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
  const { course_id, num_codes, expires_in_days } = input; 
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
  user_profile_id: string; 
  user_type: UserRole; 
}

export async function enrollUserInCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type } = input; 

  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const fkColumnNameInEnrollmentTable = user_type === 'student' ? 'student_id' : 'teacher_id';
  
  const { data: existingEnrollment, error: fetchError } = await supabaseAdmin
    .from(enrollmentTable)
    .select('id')
    .eq(fkColumnNameInEnrollmentTable, user_profile_id)
    .eq('course_id', course_id)
    .maybeSingle(); 
  
  if (fetchError && fetchError.code !== 'PGRST116') { 
    console.error(`Error checking existing enrollment for ${user_type}:`, fetchError);
    return { ok: false, message: `Database error checking enrollment: ${fetchError.message}` };
  }
  if (existingEnrollment) {
    return { ok: false, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} is already enrolled in this course.` };
  }
  
  const enrollmentData: any = { 
      id: uuidv4(), 
      course_id, 
  };
  enrollmentData[fkColumnNameInEnrollmentTable] = user_profile_id;

  if (user_type === 'student') {
    enrollmentData.enrolled_at = new Date().toISOString();
  } else { // teacher
    enrollmentData.assigned_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin.from(enrollmentTable).insert(enrollmentData);

  if (error) {
    console.error(`Error enrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to enroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  revalidatePath(`/lms/courses/${course_id}`);
  revalidatePath('/lms/available-courses');
  revalidatePath('/student/study-material');
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} enrolled successfully.` };
}

export async function unenrollUserFromCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type } = input;

  const enrollmentTable = user_type === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
  const fkColumnNameInEnrollmentTable = user_type === 'student' ? 'student_id' : 'teacher_id';
  
  const { error } = await supabaseAdmin
    .from(enrollmentTable)
    .delete()
    .eq(fkColumnNameInEnrollmentTable, user_profile_id)
    .eq('course_id', course_id);
  
  if (error) {
    console.error(`Error unenrolling ${user_type}:`, error);
    return { ok: false, message: `Failed to unenroll ${user_type}: ${error.message}` };
  }
  revalidatePath(`/admin/lms/courses/${course_id}/enrollments`);
  revalidatePath(`/lms/courses/${course_id}`);
  revalidatePath('/lms/available-courses');
  revalidatePath('/student/study-material');
  return { ok: true, message: `${user_type.charAt(0).toUpperCase() + user_type.slice(1)} unenrolled successfully.` };
}

// --- Fetching Enrolled Users ---
export async function getEnrolledStudentsForCourseAction(
  courseId: string
): Promise<{ ok: boolean; students?: Student[]; message?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('lms_student_course_enrollments')
    .select('student_id') 
    .eq('course_id', courseId);

  if (enrollmentError) {
    console.error("Error fetching student enrollments:", enrollmentError);
    return { ok: false, message: `Failed to fetch student enrollments: ${enrollmentError.message}` };
  }

  if (!enrollments || enrollments.length === 0) {
    return { ok: true, students: [] };
  }

  const studentIdsFromEnrollments = enrollments.map(e => e.student_id).filter(id => !!id);
  if (studentIdsFromEnrollments.length === 0) {
    return { ok: true, students: [] };
  }
  
  const { data: studentsData, error: studentsError } = await supabaseAdmin
    .from('students') 
    .select('*') 
    .in('id', studentIdsFromEnrollments); 

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

  const teacherIds = enrollments.map(e => e.teacher_id).filter(id => !!id);
  if (teacherIds.length === 0) {
    return { ok: true, teachers: [] };
  }

  const { data: teachersData, error: teachersError } = await supabaseAdmin
    .from('teachers')
    .select('*') 
    .in('id', teacherIds);

  if (teachersError) {
    console.error("Error fetching teacher details:", teachersError);
    return { ok: false, message: `Failed to fetch teacher details: ${teachersError.message}` };
  }

  return { ok: true, teachers: (teachersData as Teacher[]) || [] };
}

// --- Get Available Courses with Enrollment Status ---
interface GetAvailableCoursesInput {
  userProfileId: string | null;
  userRole: UserRole | null;
  userSchoolId: string | null;
}

export async function getAvailableCoursesWithEnrollmentStatusAction(
  input: GetAvailableCoursesInput
): Promise<{ ok: boolean; courses?: CourseWithEnrollmentStatus[]; message?: string }> {
  const supabase = createSupabaseServerClient();
  const { userProfileId, userRole, userSchoolId } = input;

  try {
    let courseQuery = supabase.from('lms_courses').select('*');
    if (userSchoolId && userRole !== 'superadmin') {
      courseQuery = courseQuery.or(`school_id.eq.${userSchoolId},school_id.is.null`);
    } else if (userRole !== 'superadmin') { 
      courseQuery = courseQuery.is('school_id', null);
    }

    const { data: coursesData, error: coursesError } = await courseQuery.order('created_at', { ascending: false });

    if (coursesError) {
      console.error("Error fetching courses:", coursesError);
      return { ok: false, message: `Failed to fetch courses: ${coursesError.message}` };
    }
    if (!coursesData) {
      return { ok: true, courses: [] };
    }

    let enrolledCourseIds: string[] = [];
    if (userProfileId && (userRole === 'student' || userRole === 'teacher')) {
      const enrollmentTable = userRole === 'student' ? 'lms_student_course_enrollments' : 'lms_teacher_course_enrollments';
      const fkColumn = userRole === 'student' ? 'student_id' : 'teacher_id';
      
      const { data: enrollments, error: enrollmentError } = await supabase
        .from(enrollmentTable)
        .select('course_id')
        .eq(fkColumn, userProfileId);

      if (enrollmentError) {
        console.warn(`Could not fetch enrollment status for ${userRole} ${userProfileId}: ${enrollmentError.message}`);
      } else if (enrollments) {
        enrolledCourseIds = enrollments.map(e => e.course_id);
      }
    }

    const coursesWithStatus: CourseWithEnrollmentStatus[] = coursesData.map(course => ({
      ...course,
      isEnrolled: (userRole === 'admin' || userRole === 'superadmin') ? true : enrolledCourseIds.includes(course.id),
    }));
    
    return { ok: true, courses: coursesWithStatus };

  } catch (error: any) {
    console.error("Error in getAvailableCoursesWithEnrollmentStatusAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


// --- Actions for Course Activation Page ---
interface CourseActivationPageData {
    targetCourse?: Course | null;
    userProfileId?: string | null;
    userSchoolId?: string | null;
    userRole?: UserRole | null;
}
export async function getCourseActivationPageInitialDataAction(
  courseIdFromQuery: string | null,
  userId: string // This is users.id
): Promise<{ ok: boolean; data?: CourseActivationPageData; message?: string }> {
  const supabase = createSupabaseServerClient();
  const resultData: CourseActivationPageData = {};

  try {
    // Fetch user details including role and school_id
    const { data: userRec, error: userError } = await supabase
      .from('users')
      .select('id, role, school_id')
      .eq('id', userId)
      .single();

    if (userError || !userRec) {
      return { ok: false, message: userError?.message || "User record not found." };
    }
    resultData.userRole = userRec.role as UserRole;
    resultData.userSchoolId = userRec.school_id;

    // Fetch specific user profile (student or teacher)
    if (resultData.userRole === 'student') {
      const { data: studentProfile, error: studentError } = await supabase
        .from('students')
        .select('id') // students.id
        .eq('user_id', userId)
        .single();
      if (studentError || !studentProfile) {
        return { ok: false, message: studentError?.message || "Student profile not found." };
      }
      resultData.userProfileId = studentProfile.id;
    } else if (resultData.userRole === 'teacher') {
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teachers')
        .select('id') // teachers.id
        .eq('user_id', userId)
        .single();
      if (teacherError || !teacherProfile) {
        return { ok: false, message: teacherError?.message || "Teacher profile not found." };
      }
      resultData.userProfileId = teacherProfile.id;
    }

    // Fetch target course details if courseIdFromQuery is provided
    if (courseIdFromQuery) {
      const { data: courseData, error: courseError } = await supabase
        .from('lms_courses')
        .select('*')
        .eq('id', courseIdFromQuery)
        .single();
      if (courseError || !courseData) {
        console.warn(`Could not fetch target course ${courseIdFromQuery}: ${courseError?.message}`);
      } else {
        resultData.targetCourse = courseData as Course;
      }
    }

    return { ok: true, data: resultData };

  } catch (error: any) {
    console.error("Error in getCourseActivationPageInitialDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


interface ActivateCourseWithCodeInput {
  activationCode: string;
  userProfileId: string; // students.id or teachers.id
  userId: string; // users.id (for marking code as used)
  userRole: UserRole;
  schoolId: string | null; // User's school_id, can be null for global courses/users
}
export async function activateCourseWithCodeAction(
  input: ActivateCourseWithCodeInput
): Promise<{ ok: boolean; message: string; activatedCourse?: { id: string; title: string | null } }> {
  const supabase = createSupabaseServerClient();
  const { activationCode, userProfileId, userId, userRole, schoolId } = input;

  try {
    const { data: codeToActivate, error: codeError } = await supabase
      .from('lms_course_activation_codes')
      .select('*')
      .eq('code', activationCode.toUpperCase())
      .single();

    if (codeError || !codeToActivate) {
      return { ok: false, message: "Invalid activation code." };
    }
    if (codeToActivate.is_used) {
      return { ok: false, message: "This activation code has already been used." };
    }
    if (codeToActivate.expiry_date && new Date() > new Date(codeToActivate.expiry_date)) {
      return { ok: false, message: "This activation code has expired." };
    }
    
    const { data: courseDetails, error: courseDetailsError } = await supabase
        .from('lms_courses')
        .select('id, title, school_id')
        .eq('id', codeToActivate.course_id)
        .single();

    if (courseDetailsError || !courseDetails) {
        return { ok: false, message: "Course associated with this code not found."};
    }

    if (courseDetails.school_id && courseDetails.school_id !== schoolId) {
        return { ok: false, message: "This activation code is for a course not available to your school."};
    }


    const enrollmentResult = await enrollUserInCourseAction({
      course_id: codeToActivate.course_id,
      user_profile_id: userProfileId,
      user_type: userRole,
    });

    if (!enrollmentResult.ok && !enrollmentResult.message.includes("already enrolled")) {
      return { ok: false, message: `Enrollment failed: ${enrollmentResult.message}` };
    }

    const { error: updateCodeError } = await supabase
      .from('lms_course_activation_codes')
      .update({ is_used: true, used_by_user_id: userId, used_at: new Date().toISOString() })
      .eq('id', codeToActivate.id);

    if (updateCodeError) {
      console.error("Critical: Failed to mark activation code as used after enrollment:", updateCodeError);
      return { 
        ok: true, 
        message: "Course enrolled, but there was an issue finalizing the activation code. Please contact support if problems persist.",
        activatedCourse: { id: courseDetails.id, title: courseDetails.title }
      };
    }

    revalidatePath('/lms/available-courses');
    revalidatePath(`/lms/courses/${codeToActivate.course_id}`);

    return { 
      ok: true, 
      message: `Successfully activated and enrolled in: ${courseDetails.title || 'the course'}.`, 
      activatedCourse: { id: courseDetails.id, title: courseDetails.title }
    };

  } catch (error: any) {
    console.error("Error in activateCourseWithCodeAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred during course activation." };
  }
}

    