

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType, Student, Teacher, UserRole, CourseWithEnrollmentStatus, LessonContentResource, QuizQuestion, SchoolEntry, SchoolDetails, SubscriptionPlan, ClassData } from '@/types';
import { addMonths, addYears } from 'date-fns';


export async function getAdminLmsPageData(adminUserId: string): Promise<{
  ok: boolean;
  message?: string;
  school?: SchoolDetails | null;
  courses?: CourseWithEnrollmentStatus[];
  classes?: ClassData[];
}> {
  if (!adminUserId) {
    return { ok: false, message: "Admin user ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: user, error: userError } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
    if (userError) throw new Error(userError.message);
    if (!user?.school_id) {
      return { ok: false, message: "Admin is not linked to a school." };
    }
    const schoolId = user.school_id;

    const [schoolResult, coursesResult, classesResult] = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      getCoursesForSchoolAction(schoolId),
      supabase.from('classes').select('*').eq('school_id', schoolId)
    ]);

    if (schoolResult.error) throw new Error(`Failed to fetch school details: ${schoolResult.error.message}`);
    if (!coursesResult.ok) throw new Error(coursesResult.message || "Failed to fetch courses.");
    if (classesResult.error) throw new Error(`Failed to fetch classes: ${classesResult.error.message}`);

    return {
      ok: true,
      school: schoolResult.data,
      courses: coursesResult.courses,
      classes: classesResult.data
    };
  } catch (e: any) {
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}


// --- Course Management ---
export async function createCourseAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const courseId = uuidv4();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const school_id = formData.get('school_id') as string | null;
  const created_by_user_id = formData.get('created_by_user_id') as string;
  const featureImageFile = formData.get('feature_image_url') as File | null;
  
  let feature_image_url: string | undefined = undefined;

  try {
    if (featureImageFile && featureImageFile.size > 0) {
      const sanitizedFileName = featureImageFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `public/course-feature-images/${school_id || 'global'}/${courseId}-${sanitizedFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('campushub')
        .upload(filePath, featureImageFile);

      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: publicUrlData } = await supabaseAdmin.storage.from('campushub').getPublicUrl(filePath);
      feature_image_url = publicUrlData?.publicUrl;
    }

    const insertData: Omit<Course, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string } = {
      id: courseId,
      title,
      description,
      feature_image_url,
      is_paid: false, // All courses are free now
      price: null,
      discount_percentage: null,
      school_id: school_id === '' ? null : school_id,
      created_by_user_id,
      subscription_plan: 'free',
      max_users_allowed: formData.get('max_users_allowed') ? Number(formData.get('max_users_allowed')) : null,
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
    revalidatePath('/superadmin/lms/courses');
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
  const school_id = formData.get('school_id') as string | null;
  
  try {
    const updateData: Partial<Course> = {
      title,
      description,
      is_paid: false,
      price: null,
      discount_percentage: null,
      school_id: school_id === '' ? null : school_id,
      subscription_plan: 'free',
      max_users_allowed: formData.get('max_users_allowed') ? Number(formData.get('max_users_allowed')) : null,
      updated_at: new Date().toISOString(),
    };

    if (formData.has('feature_image_url') && formData.get('feature_image_url') instanceof File) {
      const featureImageFile = formData.get('feature_image_url') as File;
      if (featureImageFile && featureImageFile.size > 0) {
        const sanitizedFileName = featureImageFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `public/course-feature-images/${school_id || 'global'}/${id}-${sanitizedFileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('campushub')
          .upload(filePath, featureImageFile, { upsert: true });

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = await supabaseAdmin.storage.from('campushub').getPublicUrl(filePath);
        updateData.feature_image_url = publicUrlData.publicUrl;
      }
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
  
  await supabaseAdmin.from('lms_school_subscriptions').delete().eq('course_id', id);
  await supabaseAdmin.from('lms_course_school_availability').delete().eq('course_id', id);
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
  revalidatePath('/superadmin/lms/courses');
  revalidatePath('/lms/available-courses');
  return { ok: true, message: 'Course and related data deleted successfully.' };
}

export async function getCoursesForSchoolAction(schoolId: string): Promise<{
    ok: boolean;
    courses?: CourseWithEnrollmentStatus[];
    message?: string;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: availability, error: availabilityError } = await supabase
            .from('lms_course_school_availability')
            .select('course_id, target_audience_in_school')
            .eq('school_id', schoolId);
        
        if (availabilityError) throw availabilityError;

        if (!availability || availability.length === 0) {
            return { ok: true, courses: [] };
        }

        const courseIds = availability.map(a => a.course_id);
        const [coursesRes, subscriptionsRes] = await Promise.all([
          supabase.from('lms_courses').select('*').in('id', courseIds),
          supabase.from('lms_school_subscriptions').select('course_id, subscription_date').eq('school_id', schoolId).eq('status', 'active')
        ]);

        if (coursesRes.error) throw coursesRes.error;
        if (subscriptionsRes.error) console.warn("Could not fetch school subscriptions:", subscriptionsRes.error.message);

        const coursesWithSchoolStatus = (coursesRes.data || []).map(c => {
            const availInfo = availability.find(a => a.course_id === c.id);
            return {
                ...c,
                isEnrolled: true, // School is always considered enrolled if the course is in the availability table.
                target_audience_in_school: availInfo?.target_audience_in_school,
            };
        });

        return { ok: true, courses: coursesWithSchoolStatus };
    } catch (e: any) {
        return { ok: false, message: e.message || 'An unexpected error occurred.' };
    }
}

export async function enrollSchoolInCourseAction(courseId: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    
    // Check if it's already available to prevent duplicates, though upsert handles this.
    const { data: existing, error: checkError } = await supabase
        .from('lms_course_school_availability')
        .select('course_id')
        .eq('course_id', courseId)
        .eq('school_id', schoolId)
        .maybeSingle();

    if (checkError) {
        return { ok: false, message: `Database error checking availability: ${checkError.message}` };
    }
    if (existing) {
        return { ok: true, message: "Course is already available to your school." };
    }

    const { error } = await supabase
        .from('lms_course_school_availability')
        .insert({
            course_id: courseId,
            school_id: schoolId,
            target_audience_in_school: 'both' // Default to both
        });

    if (error) {
        console.error("Error making course available to school:", error);
        return { ok: false, message: `Failed to make course available: ${error.message}` };
    }
    
    revalidatePath('/admin/lms/courses');
    return { ok: true, message: "Course successfully made available to your school." };
}


export async function assignCourseToSchoolAudienceAction(params: {
  courseId: string;
  schoolId: string;
  targetAudience: 'all_students' | 'all_teachers' | 'class';
  classId?: string;
}): Promise<{ ok: boolean; message: string }> {
  const { courseId, schoolId, targetAudience, classId } = params;
  const supabase = createSupabaseServerClient();

  try {
    let audience: 'student' | 'teacher' | 'both';
    let targetClass: string | null = null;
    let messageAudience = '';
    
    if (targetAudience === 'all_students') {
      audience = 'student';
      messageAudience = 'all students';
    } else if (targetAudience === 'all_teachers') {
      audience = 'teacher';
      messageAudience = 'all teachers';
    } else if (targetAudience === 'class' && classId) {
      audience = 'student'; 
      targetClass = classId;
      const { data: classData } = await supabase.from('classes').select('name, division').eq('id', classId).single();
      messageAudience = `class ${classData?.name}-${classData?.division}`;
    } else {
        return { ok: false, message: "Invalid audience selection." };
    }
    
    // Upsert to handle both new assignments and updates
    const { error } = await supabase
      .from('lms_course_school_availability')
      .upsert({
        course_id: courseId,
        school_id: schoolId,
        target_audience_in_school: audience,
        target_class_id: targetClass
      }, { onConflict: 'course_id, school_id' });
    
    if (error) {
      throw error;
    }

    revalidatePath('/admin/lms/courses');
    revalidatePath('/lms/available-courses');
    
    return { ok: true, message: `Course is now visible to ${messageAudience}. They can now enroll themselves.` };
    
  } catch (error: any) {
    console.error("Error assigning course to audience:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
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
export async function updateResourceInLessonAction(
  lessonResourceId: string,
  resourceId: string,
  updatedResource: LessonContentResource,
): Promise<{ ok: boolean, message: string }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data: lesson, error: fetchError } = await supabase
            .from('lms_course_resources')
            .select('url_or_content')
            .eq('id', lessonResourceId)
            .single();

        if (fetchError || !lesson) {
            return { ok: false, message: "Parent lesson not found." };
        }

        let currentContent: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]');
        const resourceIndex = currentContent.findIndex(r => r.id === resourceId);

        if (resourceIndex === -1) {
            return { ok: false, message: "Resource to update not found within the lesson." };
        }

        currentContent[resourceIndex] = updatedResource;

        const { error: updateError } = await supabase
            .from('lms_course_resources')
            .update({ url_or_content: JSON.stringify(currentContent) })
            .eq('id', lessonResourceId);

        if (updateError) throw updateError;
        
        revalidatePath('/admin/lms/courses');
        return { ok: true, message: "Resource updated successfully." };
    } catch(e: any) {
        return { ok: false, message: `Failed to update resource: ${e.message}`};
    }
}


export async function deleteCourseResourceAction(
  lessonResourceId: string,
  contentToRemove?: LessonContentResource[] // if you're just deleting a lesson, this is empty
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
    try {
        if (contentToRemove) {
            const { error: updateError } = await supabase
                .from('lms_course_resources')
                .update({ url_or_content: JSON.stringify(contentToRemove) })
                .eq('id', lessonResourceId);
            if (updateError) throw updateError;
            revalidatePath('/admin/lms/courses');
            return {ok: true, message: "Resource removed from lesson."}
        } else {
             // Deleting the whole lesson
             const { error } = await supabase.from('lms_course_resources').delete().eq('id', lessonResourceId);
             if (error) throw error;
             revalidatePath('/admin/lms/courses');
             return {ok: true, message: "Lesson deleted."};
        }
    } catch(e: any) {
        return { ok: false, message: `Failed to delete resource: ${e.message}`};
    }
}


export async function createSignedUploadUrlAction(
    courseId: string,
    fileName: string,
    fileType: string
): Promise<{ ok: boolean; message: string; signedUrl?: string; publicUrl?: string; path?: string }> {
    const supabase = createSupabaseServerClient();

    try {
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


export async function addResourceToLessonAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const lessonId = formData.get('lessonId') as string;
  const courseId = formData.get('courseId') as string;
  const resourceTitle = formData.get('resourceTitle') as string;
  const resourceType = formData.get('resourceType') as CourseResourceType;
  const urlOrContent = formData.get('urlOrContent') as string | null;

  if (!lessonId || !courseId || !resourceTitle || !resourceType) {
    return { ok: false, message: "Missing required fields for adding resource." };
  }

  if (!urlOrContent && ['ebook', 'video', 'webinar', 'quiz', 'note', 'ppt'].includes(resourceType)) {
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

// --- Enrollment Management ---
interface ManageEnrollmentInput {
  course_id: string;
  user_profile_id: string; 
  user_type: UserRole;
  school_id: string;
}

export async function enrollUserInCourseAction(
  input: ManageEnrollmentInput
): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  const { course_id, user_profile_id, user_type, school_id } = input; 

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
  enrollmentData['school_id'] = school_id;

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
  input: Omit<ManageEnrollmentInput, 'school_id'>
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
  courseId: string,
  schoolId: string
): Promise<{ ok: boolean; students?: Student[]; message?: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('lms_student_course_enrollments')
    .select('student_id') 
    .eq('course_id', courseId)
    .eq('school_id', schoolId);

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
  courseId: string,
  schoolId: string
): Promise<{ ok: boolean; teachers?: Teacher[]; message?: string }> {
  const supabaseAdmin = createSupabaseServerClient();

  const { data: enrollments, error: enrollmentError } = await supabaseAdmin
    .from('lms_teacher_course_enrollments')
    .select('teacher_id') 
    .eq('course_id', courseId)
    .eq('school_id', schoolId);

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

  if (!userRole) {
    return { ok: false, message: "User role not provided." };
  }
  // All roles (except superadmin) must have a school context to see courses.
  if (userRole !== 'superadmin' && !userSchoolId) {
    return { ok: true, courses: [] }; 
  }

  try {
    let courseQuery = supabase.from('lms_courses').select('*');
    
    // Step 1: Determine which courses are even VISIBLE to the user based on their school and role
    if (userRole !== 'superadmin') {
      const { data: availableRecords, error: availabilityError } = await supabase
          .from('lms_course_school_availability')
          .select('course_id, target_audience_in_school, target_class_id')
          .eq('school_id', userSchoolId!);
      
      if (availabilityError) throw availabilityError;
      if (!availableRecords || availableRecords.length === 0) return { ok: true, courses: [] };

      let courseIdsForUser: string[] = [];

      if (userRole === 'admin') {
          // Admins see all courses available to their school
          courseIdsForUser = availableRecords.map(rec => rec.course_id);
      } else if (userRole === 'teacher') {
          // Teachers see courses assigned to 'all_teachers' or 'both'
          courseIdsForUser = availableRecords
              .filter(rec => rec.target_audience_in_school === 'teacher' || rec.target_audience_in_school === 'both')
              .map(rec => rec.course_id);
      } else if (userRole === 'student') {
          if (!userProfileId) return { ok: false, message: "Could not load student profile." };
          
          const { data: studentData, error: studentError } = await supabase.from('students').select('class_id').eq('id', userProfileId).single();
          if (studentError) return { ok: false, message: "Could not fetch student's class information."};
          
          const studentClassId = studentData?.class_id;

          // Students see courses assigned to 'all_students' (where target_class is null) OR their specific class
          courseIdsForUser = availableRecords
            .filter(rec => 
                (rec.target_audience_in_school === 'student' && !rec.target_class_id) || 
                (rec.target_class_id && rec.target_class_id === studentClassId)
            )
            .map(rec => rec.course_id);
      }
      
      if (courseIdsForUser.length === 0) return { ok: true, courses: [] };
      courseQuery = courseQuery.in('id', [...new Set(courseIdsForUser)]);
    }

    const { data: coursesData, error: coursesError } = await courseQuery.order('created_at', { ascending: false });

    if (coursesError) throw coursesError;
    if (!coursesData) return { ok: true, courses: [] };

    // --- Step 3: Check the enrollment status for the visible courses ---
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
    
    if (userRole === 'admin' && userSchoolId) {
        const { data: schoolAssignments } = await supabase.from('lms_course_school_availability').select('course_id').eq('school_id', userSchoolId);
        enrolledCourseIds = schoolAssignments?.map(s => s.course_id) || [];
    }


    const coursesWithStatus: CourseWithEnrollmentStatus[] = coursesData.map(course => ({
      ...course,
      isEnrolled: (userRole === 'superadmin') ? true : enrolledCourseIds.includes(course.id),
    }));
    
    return { ok: true, courses: coursesWithStatus };

  } catch (error: any) {
    console.error("Error in getAvailableCoursesWithEnrollmentStatusAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
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


// --- New action for LMS sidebar count ---
export async function getAssignedCoursesCountForSchool(schoolId: string): Promise<number> {
    if (!schoolId) return 0;
    const supabase = createSupabaseServerClient();
    const { count, error } = await supabase
        .from('lms_course_school_availability')
        .select('course_id', { count: 'exact', head: true })
        .eq('school_id', schoolId);
    
    if (error) {
        console.error("Error fetching assigned course count:", error);
        return 0;
    }
    return count || 0;
}







