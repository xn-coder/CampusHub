

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Course, SchoolEntry, SubscriptionPlan } from '@/types';


export async function getCoursesForSuperAdminAction(): Promise<{ ok: boolean; courses?: Course[], message?: string }> {
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('lms_courses')
            .select('*, school:school_id(name)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching courses for superadmin:", error);
            return { ok: false, message: `Database error: ${error.message}` };
        }
        return { ok: true, courses: data as Course[] };

    } catch (e: any) {
        return { ok: false, message: e.message || 'An unexpected server error occurred.' };
    }
}

export async function createCourseAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; course?: Course }> {
  const supabaseAdmin = createSupabaseServerClient();
  const courseId = uuidv4();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const is_paid = formData.get('is_paid') === 'true';
  const price = formData.get('price') ? Number(formData.get('price')) : undefined;
  const subscription_plan = formData.get('subscription_plan') as SubscriptionPlan | null;
  const max_users_allowed = formData.get('max_users_allowed') ? Number(formData.get('max_users_allowed')) : null;
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

    const insertData = {
      id: courseId,
      title,
      description,
      feature_image_url,
      is_paid,
      price: is_paid ? price : null,
      school_id: school_id === '' ? null : school_id,
      created_by_user_id,
      subscription_plan,
      max_users_allowed: max_users_allowed && max_users_allowed > 0 ? max_users_allowed : null,
    };

    const { error, data: courseData } = await supabaseAdmin
      .from('lms_courses')
      .insert(insertData)
      .select('*, school:school_id(name)')
      .single();

    if (error) {
      console.error("Error creating course:", error);
      return { ok: false, message: `Failed to create course: ${error.message}` };
    }

    revalidatePath('/superadmin/lms/courses');
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
  const school_id = formData.get('school_id') as string | null;
  const subscription_plan = formData.get('subscription_plan') as SubscriptionPlan | null;
  const max_users_allowed = formData.get('max_users_allowed') ? Number(formData.get('max_users_allowed')) : null;
  const featureImageFile = formData.get('feature_image_url') as File | null;
  
  try {
    const updateData: Partial<Course> = {
      title,
      description,
      is_paid,
      price: is_paid ? price : null,
      school_id: school_id === '' ? null : school_id,
      subscription_plan,
      max_users_allowed: max_users_allowed && max_users_allowed > 0 ? max_users_allowed : null,
      updated_at: new Date().toISOString(),
    };

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
    
    const { error, data } = await supabaseAdmin
      .from('lms_courses')
      .update(updateData)
      .eq('id', id)
      .select('*, school:school_id(name)')
      .single();

    if (error) {
      console.error("Error updating course:", error);
      return { ok: false, message: `Failed to update course: ${error.message}` };
    }
    revalidatePath('/superadmin/lms/courses');
    return { ok: true, message: 'Course updated successfully.', course: data as Course };
  } catch (e: any) {
     return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}

export async function deleteCourseAction(id: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  
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
  revalidatePath('/superadmin/lms/courses');
  return { ok: true, message: 'Course and all related data have been deleted successfully.' };
}


export async function assignCourseToSchoolsAction(
    courseId: string, 
    schoolIds: string[],
): Promise<{ ok: boolean; message: string, successCount: number }> {
    const supabase = createSupabaseServerClient();
    if (schoolIds.length === 0) {
        // If no schools are selected, it means we need to remove all existing assignments for this course.
        const { error: deleteError } = await supabase
            .from('lms_course_school_availability')
            .delete()
            .eq('course_id', courseId);
        
        if (deleteError) {
             return { ok: false, message: `Failed to clear existing assignments: ${deleteError.message}`, successCount: 0 };
        }
        revalidatePath('/superadmin/lms/courses');
        return { ok: true, message: "All school assignments for this course have been removed.", successCount: 0 };
    }
    
    const recordsToInsert = schoolIds.map(schoolId => ({
        course_id: courseId,
        school_id: schoolId,
        target_audience_in_school: 'both' as 'student' | 'teacher' | 'both'
    }));

    // First, remove all old assignments for this course to handle de-selections
    await supabase.from('lms_course_school_availability').delete().eq('course_id', courseId);
    
    // Then, insert the new set of assignments
    const { error, count } = await supabase.from('lms_course_school_availability').insert(recordsToInsert);

    if (error) {
        console.error("Error assigning course to schools:", error);
        return { ok: false, message: `Failed to assign course to schools: ${error.message}`, successCount: 0 };
    }
    revalidatePath('/superadmin/lms/courses');
    revalidatePath('/admin/lms/courses');
    return { ok: true, message: `Course assigned to ${count || 0} school(s) successfully.`, successCount: count || 0 };
}
