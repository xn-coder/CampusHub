
'use server';

console.log('[LOG] Loading src/app/(app)/admin/class-schedule/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { ClassScheduleDB, ClassData, Subject, Teacher, UserRole } from '@/types'; // Use DB types
import { postAnnouncementAction } from '../../communication/actions';

interface ClassScheduleInput {
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string; // e.g., 'Monday', 'Tuesday'
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
}

export async function fetchClassSchedulePageData(schoolId: string): Promise<{
  ok: boolean;
  schedules?: ClassScheduleDB[];
  activeClasses?: ClassData[];
  subjects?: Subject[];
  teachers?: Teacher[];
  message?: string;
}> {
  if (!schoolId) return { ok: false, message: "School ID is required." };
  const supabase = createSupabaseServerClient();
  try {
    const [schedulesRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
      supabase.from('class_schedules').select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)').eq('school_id', schoolId).order('day_of_week').order('start_time'),
      supabase.from('classes').select('id, name, division').eq('school_id', schoolId).order('name'),
      supabase.from('subjects').select('id, name, code').eq('school_id', schoolId).order('name'),
      supabase.from('teachers').select('id, name, subject').eq('school_id', schoolId).order('name'),
    ]);

    if (schedulesRes.error) throw new Error(`Fetching schedules failed: ${schedulesRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);
    
    return {
      ok: true,
      schedules: schedulesRes.data || [],
      activeClasses: classesRes.data || [],
      subjects: subjectsRes.data || [],
      teachers: teachersRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in fetchClassSchedulePageData:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}


export async function addClassScheduleAction(
  input: ClassScheduleInput & { posted_by_user_id: string }
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('class_schedules')
      .insert({
        school_id: input.school_id,
        class_id: input.class_id,
        subject_id: input.subject_id,
        teacher_id: input.teacher_id,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
      })
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error adding class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');

    if (data) {
      const schedule = data as ClassScheduleDB & { 
        class?: { name: string, division: string }, 
        subject?: { name: string }, 
        teacher?: { name: string } 
      };
      
      const { data: adminUser } = await supabase.from('users').select('name').eq('id', input.posted_by_user_id).single();
      const adminName = adminUser?.name || 'School Administration';
      
      const className = schedule.class ? `${schedule.class.name} - ${schedule.class.division}` : 'N/A';
      const subjectName = schedule.subject?.name || 'N/A';
      const teacherName = schedule.teacher?.name || 'N/A';

      const announcementContent = `A new class has been scheduled for subject "${subjectName}" in class "${className}".\n\nDetails:\n- Day: ${schedule.day_of_week}\n- Time: ${schedule.start_time} - ${schedule.end_time}\n- Teacher: ${teacherName}`;

      await postAnnouncementAction({
        title: `New Class Scheduled: ${subjectName} for ${className}`,
        content: announcementContent,
        author_name: adminName,
        posted_by_user_id: input.posted_by_user_id,
        posted_by_role: 'admin',
        school_id: input.school_id,
      });
    }

    return { ok: true, message: 'Class schedule added and announcement posted.', schedule: data as ClassScheduleDB };
  } catch (e: any) {
    console.error("Unexpected error adding schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function updateClassScheduleAction(
  id: string,
  input: Partial<ClassScheduleInput> & { school_id: string; posted_by_user_id: string }
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('class_schedules')
      .update({
        school_id: input.school_id,
        class_id: input.class_id,
        subject_id: input.subject_id,
        teacher_id: input.teacher_id,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
      })
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error updating class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    
    if (data) {
       const schedule = data as ClassScheduleDB & { 
        class?: { name: string, division: string }, 
        subject?: { name: string }, 
        teacher?: { name: string } 
      };
      
      const { data: adminUser } = await supabase.from('users').select('name').eq('id', input.posted_by_user_id).single();
      const adminName = adminUser?.name || 'School Administration';
      
      const className = schedule.class ? `${schedule.class.name} - ${schedule.class.division}` : 'N/A';
      const subjectName = schedule.subject?.name || 'N/A';
      const teacherName = schedule.teacher?.name || 'N/A';

      const announcementContent = `The schedule for subject "${subjectName}" in class "${className}" has been updated.\n\nNew Details:\n- Day: ${schedule.day_of_week}\n- Time: ${schedule.start_time} - ${schedule.end_time}\n- Teacher: ${teacherName}`;

      await postAnnouncementAction({
        title: `Schedule Update: ${subjectName} for ${className}`,
        content: announcementContent,
        author_name: adminName,
        posted_by_user_id: input.posted_by_user_id,
        posted_by_role: 'admin',
        school_id: input.school_id,
      });
    }

    return { ok: true, message: 'Class schedule updated and announcement posted.', schedule: data as ClassScheduleDB };
  } catch (e: any) {
    console.error("Unexpected error updating schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function deleteClassScheduleAction(id: string, school_id: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error } = await supabase
      .from('class_schedules')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) {
      console.error("Error deleting class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    // Optionally, send cancellation notification emails here
    return { ok: true, message: 'Class schedule deleted successfully.' };
  } catch (e: any) {
    console.error("Unexpected error deleting schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
