'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { ClassScheduleDB, ClassData, Subject, Teacher } from '@/types'; // Use DB types

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
  input: ClassScheduleInput
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    // Add validation for overlapping times for same class or teacher if needed
    const { data, error } = await supabase
      .from('class_schedules')
      .insert(input)
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error adding class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    return { ok: true, message: 'Class schedule added successfully.', schedule: data as ClassScheduleDB };
  } catch (e: any) {
    console.error("Unexpected error adding schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function updateClassScheduleAction(
  id: string,
  input: Partial<ClassScheduleInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; schedule?: ClassScheduleDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('class_schedules')
      .update(input)
      .eq('id', id)
      .eq('school_id', input.school_id)
      .select('*, class:class_id(name, division), subject:subject_id(name, code), teacher:teacher_id(name)')
      .single();

    if (error) {
      console.error("Error updating class schedule:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/admin/class-schedule');
    return { ok: true, message: 'Class schedule updated successfully.', schedule: data as ClassScheduleDB };
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
    return { ok: true, message: 'Class schedule deleted successfully.' };
  } catch (e: any) {
    console.error("Unexpected error deleting schedule:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
