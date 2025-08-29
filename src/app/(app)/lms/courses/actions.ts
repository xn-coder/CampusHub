

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseWithEnrollmentStatus, UserRole, ClassData, SchoolDetails } from '@/types';


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
          supabase.from('lms_school_subscriptions').select('course_id, end_date').eq('school_id', schoolId)
        ]);

        if (coursesRes.error) throw coursesRes.error;
        if (subscriptionsRes.error) console.warn("Could not fetch school subscriptions:", subscriptionsRes.error.message);

        const subscribedCourseIds = new Set((subscriptionsRes.data || []).map(sub => sub.course_id));
        
        const subscriptionEndDateMap = (subscriptionsRes.data || []).reduce((acc, sub) => {
            acc[sub.course_id] = sub.end_date;
            return acc;
        }, {} as Record<string, string | null>);
        
        const coursesWithSchoolStatus = (coursesRes.data || []).map(c => {
            const isEnrolled = subscribedCourseIds.has(c.id);
            const availInfo = availability.find(a => a.course_id === c.id);
            return {
                ...c,
                isEnrolled,
                target_audience_in_school: availInfo?.target_audience_in_school,
                subscription_end_date: subscriptionEndDateMap[c.id] || null,
            };
        });

        return { ok: true, courses: coursesWithSchoolStatus };
    } catch (e: any) {
        return { ok: false, message: e.message || 'An unexpected error occurred.' };
    }
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
    
    const { error } = await supabase
      .from('lms_course_school_availability')
      .upsert({
        course_id: courseId,
        school_id: schoolId,
        target_audience_in_school: audience,
        target_class_id: targetClass
      }, { onConflict: 'course_id, school_id' });
    
    if (error) throw error;

    revalidatePath('/admin/lms/courses');
    revalidatePath('/lms/available-courses');
    
    return { ok: true, message: `Course is now visible to ${messageAudience}. They can now enroll themselves.` };
    
  } catch (error: any) {
    console.error("Error assigning course to audience:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function enrollSchoolInCourseAction(courseId: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { data: course, error: courseError } = await supabase.from('lms_courses').select('is_paid').eq('id', courseId).single();
  if (courseError || !course) return { ok: false, message: "Course not found." };
  if (course.is_paid) return { ok: false, message: "This is a paid course and requires a subscription." };

  const { error: subError } = await supabase
      .from('lms_school_subscriptions')
      .upsert({
          course_id: courseId,
          school_id: schoolId,
          status: 'active',
          amount_paid: 0,
          razorpay_payment_id: `FREE_ENROLL_${uuidv4()}`
      }, { onConflict: 'course_id, school_id' });

  if (subError) {
      console.error("Error enrolling school in free course (creating subscription record):", subError);
      return { ok: false, message: `Failed to enroll school: ${subError.message}` };
  }

  revalidatePath('/admin/lms/courses');
  return { ok: true, message: "School successfully enrolled in the free course." };
}

export async function unassignCourseFromSchoolAction(courseId: string, schoolId: string): Promise<{ ok: boolean, message: string }> {
    const supabase = createSupabaseServerClient();
    try {
        // Unenroll all users from this school for this course first
        await supabase.from('lms_student_course_enrollments').delete().eq('course_id', courseId).eq('school_id', schoolId);
        await supabase.from('lms_teacher_course_enrollments').delete().eq('course_id', courseId).eq('school_id', schoolId);
        
        // Remove the availability record
        const { error: availabilityError } = await supabase.from('lms_course_school_availability').delete().eq('course_id', courseId).eq('school_id', schoolId);
        if (availabilityError) throw new Error(`Failed to unassign course: ${availabilityError.message}`);

        // Also remove subscription if it exists
        await supabase.from('lms_school_subscriptions').delete().eq('course_id', courseId).eq('school_id', schoolId);

        revalidatePath('/admin/lms/courses');
        revalidatePath('/lms/available-courses');
        return { ok: true, message: "Course unassigned from your school. All users have been unenrolled."};

    } catch (e: any) {
        console.error("Error in unassignCourseFromSchoolAction:", e);
        return { ok: false, message: e.message || 'An unexpected error occurred.' };
    }
}
