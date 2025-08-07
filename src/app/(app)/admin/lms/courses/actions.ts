
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseResource, CourseActivationCode, CourseResourceType, Student, Teacher, UserRole, CourseWithEnrollmentStatus, LessonContentResource, QuizQuestion, SchoolEntry, SchoolDetails, SubscriptionPlan, ClassData } from '@/types';
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
      is_paid: false, 
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
      school_id: school_id === '' ? null : school_id,
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
          supabase.from('lms_school_subscriptions').select('course_id').eq('school_id', schoolId).eq('status', 'active')
        ]);

        if (coursesRes.error) throw coursesRes.error;
        if (subscriptionsRes.error) console.warn("Could not fetch school subscriptions:", subscriptionsRes.error.message);

        const subscribedCourseIds = new Set((subscriptionsRes.data || []).map(sub => sub.course_id));
        
        const coursesWithSchoolStatus = (coursesRes.data || []).map(c => {
            const availInfo = availability.find(a => a.course_id === c.id);
            // A course is considered "enrolled" by the school if it's free OR if a subscription exists for it.
            const isEnrolled = !c.is_paid || subscribedCourseIds.has(c.id);
            return {
                ...c,
                isEnrolled,
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
    const { data: course, error: courseError } = await supabase.from('lms_courses').select('is_paid').eq('id', courseId).single();
    if(courseError || !course) return { ok: false, message: "Course not found." };
    if(course.is_paid) return { ok: false, message: "This is a paid course and requires a subscription." };

    const { error } = await supabase
        .from('lms_course_school_availability')
        .upsert({
            course_id: courseId,
            school_id: schoolId,
            target_audience_in_school: 'both' // Default to both
        }, { onConflict: 'course_id, school_id' }); // Use upsert to avoid errors if already available

    if (error) {
        console.error("Error enrolling school in free course:", error);
        return { ok: false, message: `Failed to enroll school: ${error.message}` };
    }
    revalidatePath('/admin/lms/courses');
    return { ok: true, message: "School successfully enrolled in the free course." };
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


// --- Razorpay Payment Actions for Courses ---

export async function createCoursePaymentOrderAction(courseId: string, userId: string): Promise<{
    ok: boolean;
    message: string;
    order?: any;
    isMock?: boolean;
}> {
    const isRazorpayEnabled = process.env.RAZORPAY_ENABLED === 'true';
    const supabase = createSupabaseServerClient();
    
    const { data: user, error: userError } = await supabase.from('users').select('id, role, school_id').eq('id', userId).single();
    if(userError || !user) return { ok: false, message: "User not found." };
    const userRole = user.role as UserRole;
    
    // For school admins, payment is handled differently (subscribing the school)
    if(userRole === 'admin' || userRole === 'superadmin') {
      const { data: courseData } = await supabase.from('lms_courses').select('id, price, discount_percentage').eq('id', courseId).single();
      const finalPrice = (courseData?.price || 0) * (1 - (courseData?.discount_percentage || 0) / 100);
      return createSchoolSubscriptionOrderAction(courseId, user.school_id!, finalPrice);
    }
    
    // For students/teachers
    const profileTable = userRole === 'student' ? 'students' : 'teachers';
    const { data: profile, error: profileError } = await supabase.from(profileTable).select('id').eq('user_id', userId).single();
    if(profileError || !profile) return {ok: false, message: "User profile for enrollment not found."};

    if (!isRazorpayEnabled) {
        console.log("Razorpay is disabled. Simulating successful payment and enrolling user.");
        const enrollmentResult = await enrollUserInCourseAction({
            course_id: courseId,
            user_profile_id: profile.id,
            user_type: userRole,
            school_id: user.school_id!
        });
        
        if (!enrollmentResult.ok && !enrollmentResult.message.includes("already enrolled")) {
            return { ok: false, message: `Mock payment failed: Could not enroll user. Reason: ${enrollmentResult.message}` };
        }
        revalidatePath('/lms/available-courses');
        return { ok: true, isMock: true, message: "Mock payment successful and you are now enrolled!" };
    }
    
    if (!razorpayInstance) return { ok: false, message: "Payment gateway is not configured." };
    
    const { data: course, error: courseError } = await supabase.from('lms_courses').select('price, discount_percentage').eq('id', courseId).single();
    if (courseError || !course || !course.price || course.price <= 0) {
        return { ok: false, message: "Course not found or has no price." };
    }
    
    const discount = course.discount_percentage || 0;
    const finalPrice = course.price * (1 - discount / 100);
    const amountInPaisa = Math.round(finalPrice * 100);

    const options = {
        amount: amountInPaisa,
        currency: "INR",
        receipt: `crs_${uuidv4().substring(0, 12)}`,
        notes: {
            course_id: courseId,
            user_id: userId,
            type: 'user_enrollment'
        },
    };

    try {
        const order = await razorpayInstance.orders.create(options);
        return { ok: true, message: "Order created.", order };
    } catch (error: any) {
        console.error("Razorpay course order creation error:", error);
        const errorMessage = error?.error?.description || error?.message || 'Unknown error';
        return { ok: false, message: `Failed to create payment order: ${errorMessage}` };
    }
}


export async function createSchoolSubscriptionOrderAction(courseId: string, schoolId: string, amount: number): Promise<{
    ok: boolean;
    message: string;
    order?: any;
    isMock?: boolean;
}> {
  const isRazorpayEnabled = process.env.RAZORPAY_ENABLED === 'true';
  const supabase = createSupabaseServerClient();

  if (!isRazorpayEnabled) {
      const { error } = await supabase.from('lms_school_subscriptions').insert({
          course_id: courseId,
          school_id: schoolId,
          amount_paid: amount,
          status: 'active',
          razorpay_payment_id: `MOCK_${uuidv4()}`
      });
      if (error) return { ok: false, message: `Mock subscription failed: ${error.message}`};
      revalidatePath('/admin/lms/courses');
      return { ok: true, isMock: true, message: "Mock subscription successful!" };
  }
  
  if (!razorpayInstance) return { ok: false, message: "Payment gateway is not configured." };

  const options = {
      amount: Math.round(amount * 100), // amount in paisa
      currency: "INR",
      receipt: `sch_sub_${uuidv4().substring(0, 8)}`,
      notes: {
          course_id: courseId,
          school_id: schoolId,
          type: 'school_subscription'
      },
  };

  try {
      const order = await razorpayInstance.orders.create(options);
      return { ok: true, message: "Order created.", order };
  } catch (error: any) {
      console.error("Razorpay school subscription order error:", error);
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
        const paymentType = orderDetails.notes?.type;
        const supabase = createSupabaseServerClient();

        if (paymentType === 'school_subscription') {
            const schoolId = orderDetails.notes?.school_id;
            if (!courseId || !schoolId) return { ok: false, message: "School subscription details missing."};

            const { error } = await supabase.from('lms_school_subscriptions').insert({
                course_id: courseId,
                school_id: schoolId,
                razorpay_payment_id: razorpay_payment_id,
                razorpay_order_id: razorpay_order_id,
                razorpay_signature: razorpay_signature,
                amount_paid: orderDetails.amount_paid / 100,
                currency: orderDetails.currency,
                status: 'active'
            });
            if (error) return { ok: false, message: `Payment verified but failed to save subscription: ${error.message}` };
            revalidatePath('/admin/lms/courses');
            return { ok: true, message: "School subscription successful!", courseId };

        } else { // user_enrollment
            const userId = orderDetails.notes?.user_id;
            if (!courseId || !userId) return { ok: false, message: "User enrollment details are missing." };
            
            const { data: user, error: userError } = await supabase.from('users').select('id, role, school_id').eq('id', userId).single();
            if (userError || !user) return { ok: false, message: "User associated with payment not found." };

            const userRole = user.role as UserRole;
            const profileTable = userRole === 'student' ? 'students' : 'teachers';
            const { data: profile, error: profileError } = await supabase.from(profileTable).select('id').eq('user_id', userId).single();
            if(profileError || !profile) return {ok: false, message: "User profile for enrollment not found."};
            
            const enrollmentResult = await enrollUserInCourseAction({
                course_id: ""+courseId,
                user_profile_id: profile.id,
                user_type: userRole,
                school_id: user.school_id!
            });

            if (!enrollmentResult.ok && !enrollmentResult.message.includes("already enrolled")) {
                return { ok: false, message: `Payment verified, but enrollment failed: ${enrollmentResult.message}` };
            }
            revalidatePath('/lms/available-courses');
            return { ok: true, message: "Payment successful and you are now enrolled!", courseId };
        }

    } catch (error: any) {
        console.error("Error during course payment verification:", error);
        return { ok: false, message: `An unexpected error occurred during verification: ${error.message}` };
    }
}
