

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType, Student, Teacher, UserRole, CourseWithEnrollmentStatus, LessonContentResource, QuizQuestion } from '@/types';
import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;
if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} else {
    console.warn("Razorpay credentials not found for LMS. Payment gateway will not function.");
}


// --- Course Management ---
export async function createCourseAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const courseId = uuidv4();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const is_paid = formData.get('is_paid') === 'true';
  const price = formData.get('price') ? Number(formData.get('price')) : undefined;
  const currency = formData.get('currency') as 'INR' | 'USD' | 'EUR' | undefined;
  const discount_percentage = formData.get('discount_percentage') ? Number(formData.get('discount_percentage')) : 0;
  const school_id = formData.get('school_id') as string | null;
  const target_audience = formData.get('target_audience') as 'student' | 'teacher' | 'both';
  let target_class_id = formData.get('target_class_id') as string | null;
  const created_by_user_id = formData.get('created_by_user_id') as string;
  const featureImageFile = formData.get('feature_image_url') as File | null;
  
  if (target_class_id === '' || target_class_id === 'all_students_in_school') target_class_id = null;
  
  let feature_image_url: string | undefined = undefined;

  try {
    if (featureImageFile && featureImageFile.size > 0) {
      const sanitizedFileName = featureImageFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `public/course-feature-images/${school_id || 'global'}/${courseId}-${sanitizedFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('campushub')
        .upload(filePath, featureImageFile);

      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabaseAdmin.storage.from('campushub').getPublicUrl(filePath);
      feature_image_url = publicUrlData?.publicUrl;
    }

    const insertData = {
      id: courseId,
      title,
      description,
      feature_image_url,
      is_paid,
      price: is_paid ? price : null,
      currency: is_paid ? (currency || 'INR') : null,
      discount_percentage: is_paid ? discount_percentage : null,
      school_id,
      target_audience,
      target_class_id,
      created_by_user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error, data: courseData } = await supabaseAdmin
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
    return { ok: true, message: 'Course created successfully.', course: courseData as Course };
  } catch (e: any) {
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}

export async function updateCourseAction(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const is_paid = formData.get('is_paid') === 'true';
  const price = formData.get('price') ? Number(formData.get('price')) : undefined;
  const currency = formData.get('currency') as 'INR' | 'USD' | 'EUR' | undefined;
  const discount_percentage = formData.get('discount_percentage') ? Number(formData.get('discount_percentage')) : 0;
  const school_id = formData.get('school_id') as string | null;
  const target_audience = formData.get('target_audience') as 'student' | 'teacher' | 'both';
  let target_class_id = formData.get('target_class_id') as string | null;
  const featureImageFile = formData.get('feature_image_url') as File | null;
  
  if (target_class_id === '' || target_class_id === 'all_students_in_school') target_class_id = null;
  
  try {
    const updateData: Partial<Course> = {
      title,
      description,
      is_paid,
      price: is_paid ? price : null,
      currency: is_paid ? (currency || 'INR') : null,
      discount_percentage: is_paid ? discount_percentage : null,
      school_id,
      target_audience,
      target_class_id,
      updated_at: new Date().toISOString(),
    };

    if (featureImageFile && featureImageFile.size > 0) {
      const sanitizedFileName = featureImageFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `public/course-feature-images/${school_id || 'global'}/${id}-${sanitizedFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('campushub')
        .upload(filePath, featureImageFile, { upsert: true });

      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabaseAdmin.storage.from('campushub').getPublicUrl(filePath);
      updateData.feature_image_url = publicUrlData?.publicUrl;
    }
    
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
  } catch (e: any) {
     return { ok: false, message: e.message || "An unexpected error occurred." };
  }
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

// --- Resource Management (Admin) ---

export async function getCourseContentForAdminAction(courseId: string): Promise<{
    ok: boolean;
    course?: Course;
    resources?: CourseResource[];
    message?: string;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: course, error: courseError } = await supabase.from('lms_courses').select('*').eq('id', courseId).single();
        if (courseError) throw courseError;
        
        const { data: resources, error: resourcesError } = await supabase
            .from('lms_course_resources')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: true });
        if (resourcesError) throw resourcesError;

        return { ok: true, course: course as Course, resources: (resources || []) as CourseResource[] };
    } catch (e: any) {
        return { ok: false, message: e.message };
    }
}


// Adds a "Lesson" to a course. A lesson is a container for other resources.
export async function addLessonToCourseAction(input: { course_id: string; title: string }): Promise<{ ok: boolean; message: string, resource?: CourseResource }> {
    const supabase = createSupabaseServerClient();
    const { error, data } = await supabase
        .from('lms_course_resources')
        .insert({
            course_id: input.course_id,
            title: input.title,
            type: 'note', // Lessons are stored as type 'note' to act as containers
            url_or_content: '[]' // Initialize with an empty JSON array for resources
        })
        .select()
        .single();
    
    if (error) {
      console.error("Error adding lesson:", error);
      return { ok: false, message: error.message };
    }
    revalidatePath(`/admin/lms/courses/${input.course_id}/content`);
    return { ok: true, message: "Lesson Added", resource: data as CourseResource };
}


// Updates the content of a lesson (which is a CourseResource of type 'note').
export async function updateLessonContentAction(
  lessonResourceId: string,
  newContent: LessonContentResource[]
): Promise<{ ok: boolean, message: string }> {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
        .from('lms_course_resources')
        .update({ url_or_content: JSON.stringify(newContent) })
        .eq('id', lessonResourceId);

    if (error) {
        console.error("Error updating lesson content:", error);
        return { ok: false, message: `DB error updating lesson: ${error.message}` };
    }
    revalidatePath('/admin/lms/courses'); // Revalidate the parent course content page
    return { ok: true, message: "Lesson content updated."};
}


// ==================================================================
// NEW ACTION: To create a secure URL for direct client-side file uploads
// ==================================================================
export async function createSignedUploadUrlAction(
    courseId: string,
    fileName: string,
    fileType: string
): Promise<{ ok: boolean; message: string; signedUrl?: string; publicUrl?: string; path?: string }> {
    const supabase = createSupabaseServerClient();

    try {
        // Optional but recommended: Check if the current user has permission to upload to this course.
        // For example, fetch user role and verify they are an admin or teacher for this course.

        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `public/course-uploads/${courseId}/${uuidv4()}-${sanitizedFileName}`;

        const { data, error } = await supabase.storage
            .from('campushub') // Your bucket name
            .createSignedUploadUrl(filePath);

        if (error) {
            throw new Error(`Failed to create signed URL: ${error.message}`);
        }
        
        const { data: publicUrlData } = supabase.storage
            .from('campushub')
            .getPublicUrl(filePath);

        if (!publicUrlData?.publicUrl) {
            throw new Error("Could not determine public URL for the file path.");
        }

        return {
            ok: true,
            message: "Signed URL created successfully.",
            signedUrl: data.signedUrl,
            publicUrl: publicUrlData.publicUrl,
            path: data.path,
        };

    } catch (e: any) {
        console.error("Error in createSignedUploadUrlAction:", e);
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}


// ==================================================================
// MODIFIED ACTION: No longer handles file uploads directly.
// It now only saves the metadata (including the URL) to the database.
// ==================================================================
export async function addResourceToLessonAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const lessonId = formData.get('lessonId') as string;
  const courseId = formData.get('courseId') as string;
  const resourceTitle = formData.get('resourceTitle') as string;
  const resourceType = formData.get('resourceType') as CourseResourceType;
  // This will now contain the final public URL for uploaded files, a user-entered URL, or JSON for a quiz.
  const urlOrContent = formData.get('urlOrContent') as string | null;

  if (!lessonId || !courseId || !resourceTitle || !resourceType) {
    return { ok: false, message: "Missing required fields for adding resource." };
  }

  // Basic validation: ensure urlOrContent is present for types that need it.
  if (!urlOrContent && ['ebook', 'video', 'webinar', 'quiz', 'note'].includes(resourceType)) {
      if (resourceType === 'note' && urlOrContent === '') {
          // allow empty note
      } else {
        return { ok: false, message: "Resource content (URL or data) is required." };
      }
  }

  try {
    const { data: lesson, error: fetchError } = await supabase
      .from('lms_course_resources')
      .select('url_or_content')
      .eq('id', lessonId)
      .single();
    
    if (fetchError || !lesson) {
        throw new Error("Could not find the parent lesson to add the resource to.");
    }
    
    let currentContent: LessonContentResource[] = [];
    try {
        currentContent = JSON.parse(lesson.url_or_content || '[]');
    } catch(e) {
        console.warn("Could not parse existing lesson content, starting with a new list.");
        currentContent = [];
    }

    const newResource: LessonContentResource = {
        id: uuidv4(),
        type: resourceType,
        title: resourceTitle.trim(),
        url_or_content: (urlOrContent || '').trim()
    };

    const updatedContent = [...currentContent, newResource];

    const { error: updateError } = await supabase
        .from('lms_course_resources')
        .update({ url_or_content: JSON.stringify(updatedContent) })
        .eq('id', lessonId);
    
    if (updateError) {
        throw new Error(`DB error updating lesson content: ${updateError.message}`);
    }

    revalidatePath(`/admin/lms/courses/${courseId}/content`);
    return { ok: true, message: "Resource added successfully." };
    
  } catch (e: any) {
    console.error("Error in addResourceToLessonAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}

// Deletes a course resource, which can be a lesson container or a standalone resource.
export async function deleteCourseResourceAction(resourceId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { data: resource, error: fetchError } = await supabase
    .from('lms_course_resources')
    .select('course_id')
    .eq('id', resourceId)
    .single();

  if (fetchError || !resource) {
    return { ok: false, message: "Resource not found." };
  }
  
  const { error } = await supabase.from('lms_course_resources').delete().eq('id', resourceId);
  if (error) {
    console.error("Error deleting course resource:", error);
    return { ok: false, message: error.message };
  }
  revalidatePath(`/admin/lms/courses/${resource.course_id}/content`);
  return { ok: true, message: "Resource deleted." };
}

// --- Activation Code Management (Rest of the file is unchanged) ---
// ... (the rest of your original file from generateActivationCodesAction down to the end) ...

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

    // Filter by school
    if (userSchoolId && userRole !== 'superadmin') {
      courseQuery = courseQuery.or(`school_id.eq.${userSchoolId},school_id.is.null`);
    } else if (userRole !== 'superadmin') { 
      courseQuery = courseQuery.is('school_id', null);
    }
    
    // Filter by target audience based on user role
    if (userRole === 'student') {
        courseQuery = courseQuery.in('target_audience', ['student', 'both']);
    } else if (userRole === 'teacher') {
        courseQuery = courseQuery.in('target_audience', ['teacher', 'both']);
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
        return { ok: false, message: teacherError?.message || "Teacher profile not found."};
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

// --- Razorpay Payment Actions for Courses ---

export async function createCoursePaymentOrderAction(courseId: string, userId: string): Promise<{
    ok: boolean;
    message: string;
    order?: any;
}> {
    if (!razorpayInstance) return { ok: false, message: "Payment gateway is not configured." };
    
    const supabase = createSupabaseServerClient();
    const { data: course, error: courseError } = await supabase.from('lms_courses').select('price, discount_percentage').eq('id', courseId).single();
    if (courseError || !course || !course.price || course.price <= 0) {
        return { ok: false, message: "Course not found or has no price." };
    }

    const { data: user, error: userError } = await supabase.from('users').select('id, role, school_id').eq('id', userId).single();
    if(userError || !user) return { ok: false, message: "User not found." };
    
    const discount = course.discount_percentage || 0;
    const finalPrice = course.price * (1 - discount / 100);
    const amountInPaisa = Math.round(finalPrice * 100);

    const options = {
        amount: amountInPaisa,
        currency: "INR",
        receipt: `crs_${courseId}_${uuidv4().substring(0, 8)}`,
        notes: {
            course_id: courseId,
            user_id: userId,
        },
    };

    try {
        const order = await razorpayInstance.orders.create(options);
        return { ok: true, message: "Order created.", order };
    } catch (error: any) {
        console.error("Razorpay course order creation error:", error);
        return { ok: false, message: `Failed to create payment order: ${error.message || 'Unknown error'}` };
    }
}

export async function verifyCoursePaymentAndEnrollAction(
    razorpay_payment_id: string,
    razorpay_order_id: string,
    razorpay_signature: string
): Promise<{ ok: boolean, message: string, courseId?: string }> {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !razorpayInstance) {
        return { ok: false, message: "Payment gateway is not configured on the server." };
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return { ok: false, message: "Payment verification failed: Invalid signature." };
    }

    try {
        const orderDetails = await razorpayInstance.orders.fetch(razorpay_order_id);
        const courseId = orderDetails.notes?.course_id;
        const userId = orderDetails.notes?.user_id;

        if (!courseId || !userId) {
            return { ok: false, message: "Order details are missing required information." };
        }
        
        const supabase = createSupabaseServerClient();
        const { data: user, error: userError } = await supabase.from('users').select('id, role').eq('id', userId).single();
        if (userError || !user) return { ok: false, message: "User associated with payment not found." };

        const userRole = user.role as UserRole;
        const profileTable = userRole === 'student' ? 'students' : 'teachers';
        const { data: profile, error: profileError } = await supabase.from(profileTable).select('id').eq('user_id', userId).single();
        if(profileError || !profile) return {ok: false, message: "User profile for enrollment not found."};
        
        const enrollmentResult = await enrollUserInCourseAction({
            course_id: ""+courseId,
            user_profile_id: profile.id,
            user_type: userRole,
        });

        if (!enrollmentResult.ok && !enrollmentResult.message.includes("already enrolled")) {
            return { ok: false, message: `Payment verified, but enrollment failed: ${enrollmentResult.message}` };
        }

        revalidatePath('/lms/available-courses');
        return { ok: true, message: "Payment successful and you are now enrolled!", courseId };
    } catch (error: any) {
        console.error("Error during course payment verification:", error);
        return { ok: false, message: `An unexpected error occurred during verification: ${error.message}` };
    }
}

// --- New action for navigation ---
export async function getAllCoursesForAdminNavAction(input: {
  schoolId: string | null;
  adminUserId: string | null;
  userRole: UserRole | null;
}): Promise<{ ok: boolean; courses?: { id: string; title: string }[] }> {
  const { schoolId, adminUserId, userRole } = input;
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from('lms_courses')
    .select('id, title')
    .order('created_at', { ascending: false });

  if (userRole === 'superadmin') {
    // No filter for superadmin, they see all
  } else if (schoolId) {
    // Admin/Teacher/etc. see their school's courses + global courses
    query = query.or(`school_id.eq.${schoolId},school_id.is.null`);
  } else if (adminUserId && userRole !== 'superadmin') {
    // A user with no school context (if possible) sees only global courses
    query = query.is('school_id', null);
  } else {
    // Unhandled case, return no courses
    return { ok: true, courses: [] };
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching courses for nav:", error);
    return { ok: false };
  }
  return { ok: true, courses: data || [] };
}
