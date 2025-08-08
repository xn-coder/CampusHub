

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { Course, CourseWithEnrollmentStatus, UserRole } from '@/types';


export async function getLmsPageContextAction(
  userId: string,
  userRole: UserRole
): Promise<{
  ok: boolean;
  message?: string;
  userProfileId: string | null;
  userSchoolId: string | null;
}> {
  if (!userId || !userRole) {
    return { ok: false, message: 'User context is missing.', userProfileId: null, userSchoolId: null };
  }
  
  const supabase = createSupabaseServerClient();
  
  try {
    const { data: user, error: userError } = await supabase.from('users').select('school_id').eq('id', userId).single();
    if (userError || !user) {
      return { ok: false, message: 'Could not load user context.', userProfileId: null, userSchoolId: null };
    }
    
    const userSchoolId = user.school_id;
    let userProfileId: string | null = null;
    
    if (userRole === 'student') {
      const { data: profile, error } = await supabase.from('students').select('id').eq('user_id', userId).single();
      if (error || !profile) return { ok: false, message: 'Could not load student profile.', userProfileId: null, userSchoolId };
      userProfileId = profile.id;
    } else if (userRole === 'teacher') {
      const { data: profile, error } = await supabase.from('teachers').select('id').eq('user_id', userId).single();
      if (error || !profile) return { ok: false, message: 'Could not load teacher profile.', userProfileId: null, userSchoolId };
      userProfileId = profile.id;
    }

    return { ok: true, userProfileId, userSchoolId };

  } catch (e: any) {
    return { ok: false, message: e.message || 'An unexpected error occurred.', userProfileId: null, userSchoolId: null };
  }
}


export async function getAvailableCoursesWithEnrollmentStatusAction(
  input: {
    userProfileId: string | null;
    userRole: UserRole | null;
    userSchoolId: string | null;
  }
): Promise<{ ok: boolean; courses?: CourseWithEnrollmentStatus[]; message?: string }> {
  const supabase = createSupabaseServerClient();
  const { userProfileId, userRole, userSchoolId } = input;

  if (!userRole) {
    return { ok: false, message: "User role not provided." };
  }
  if (userRole !== 'superadmin' && !userSchoolId) {
    return { ok: true, courses: [] };
  }

  try {
    let courseQuery = supabase.from('lms_courses').select('*');
    
    if (userRole !== 'superadmin') {
      const { data: availableRecords, error: availabilityError } = await supabase
          .from('lms_course_school_availability')
          .select('course_id, target_audience_in_school, target_class_id')
          .eq('school_id', userSchoolId!);
      
      if (availabilityError) throw availabilityError;
      if (!availableRecords || availableRecords.length === 0) return { ok: true, courses: [] };

      let courseIdsForUser: string[] = [];

      if (userRole === 'admin') {
          courseIdsForUser = availableRecords.map(rec => rec.course_id);
      } else if (userRole === 'teacher') {
          courseIdsForUser = availableRecords
              .filter(rec => rec.target_audience_in_school === 'teacher' || rec.target_audience_in_school === 'both')
              .map(rec => rec.course_id);
      } else if (userRole === 'student') {
          if (!userProfileId) {
             console.error("Student profile ID not provided for course lookup.");
             return { ok: false, message: "Could not load student profile." };
          }
          
          const { data: studentData, error: studentError } = await supabase.from('students').select('class_id').eq('id', userProfileId).single();
          if (studentError) {
            console.error("Error fetching student's class:", studentError);
            return { ok: false, message: "Could not fetch student's class information."};
          }
          
          const studentClassId = studentData?.class_id;
          
          courseIdsForUser = availableRecords
            .filter(rec => {
                const isForStudentAudience = rec.target_audience_in_school === 'student' || rec.target_audience_in_school === 'both';
                const isClassSpecific = rec.target_class_id !== null;
                const isGeneral = !isClassSpecific;
                
                // Visible if: it's for students AND (it's a general course OR it matches the student's class)
                return isForStudentAudience && (isGeneral || (isClassSpecific && rec.target_class_id === studentClassId));
            })
            .map(rec => rec.course_id);
      }
      
      if (courseIdsForUser.length === 0) return { ok: true, courses: [] };
      courseQuery = courseQuery.in('id', [...new Set(courseIdsForUser)]);
    }

    const { data: coursesData, error: coursesError } = await courseQuery.order('created_at', { ascending: false });

    if (coursesError) throw coursesError;
    if (!coursesData) return { ok: true, courses: [] };

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
    
    // For admins, their "enrollment" is determined by the school's subscription to paid courses. Free courses are not auto-enrolled.
    if (userRole === 'admin' && userSchoolId) {
        const { data: schoolSubscriptions } = await supabase.from('lms_school_subscriptions').select('course_id').eq('school_id', userSchoolId);
        enrolledCourseIds = schoolSubscriptions?.map(s => s.course_id) || [];
    }

    const coursesWithStatus: CourseWithEnrollmentStatus[] = coursesData.map(course => ({
      ...course,
      isEnrolled: (userRole === 'superadmin') ? true : 
                  (course.is_paid ? enrolledCourseIds.includes(course.id) : enrolledCourseIds.includes(course.id)),
    }));
    
    return { ok: true, courses: coursesWithStatus };

  } catch (error: any) {
    console.error("Error in getAvailableCoursesWithEnrollmentStatusAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function enrollUserInCourseAction(
  input: {
    course_id: string;
    user_profile_id: string; 
    user_type: UserRole;
    school_id: string;
  }
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
      course_id, 
      school_id
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
