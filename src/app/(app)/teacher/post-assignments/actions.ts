
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Assignment } from '@/types';

const NO_SUBJECT_VALUE_INTERNAL = "__NO_SUBJECT__";

interface PostAssignmentInput {
  title: string;
  description?: string;
  due_date: string; // YYYY-MM-DD
  class_id: string;
  teacher_id: string; // Teacher's profile ID (teachers.id)
  subject_id?: string; // Optional
  school_id: string;
}

export async function postAssignmentAction(
  input: PostAssignmentInput
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const assignmentId = uuidv4();
  
  const { error, data } = await supabase
    .from('assignments')
    .insert({ 
        id: assignmentId, 
        ...input,
        subject_id: (input.subject_id === NO_SUBJECT_VALUE_INTERNAL || !input.subject_id) ? null : input.subject_id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error posting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/post-assignments');
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments'); // Students should see new assignments
  return { ok: true, message: 'Assignment posted successfully.', assignment: data as Assignment };
}


export async function getTeacherAssignmentsAction(teacherId: string, schoolId: string): Promise<{ ok: boolean; message?: string; assignments?: Assignment[] }> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false });

    if (error) {
        console.error("Error fetching assignments:", error);
        return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, assignments: (data || []) as Assignment[] };
}

interface UpdateAssignmentInput extends Omit<Partial<PostAssignmentInput>, 'teacher_id' | 'school_id'> {
  id: string;
  teacher_id: string;
  school_id: string;
}


export async function updateAssignmentAction(
  input: UpdateAssignmentInput
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const { id, teacher_id, school_id, ...updateData } = input;

  const { error, data } = await supabase
    .from('assignments')
    .update({ 
        ...updateData,
        subject_id: (updateData.subject_id === NO_SUBJECT_VALUE_INTERNAL || !updateData.subject_id) ? null : updateData.subject_id,
     })
    .eq('id', id)
    .eq('teacher_id', teacher_id) // Ensure teacher can only update their own assignments
    .eq('school_id', school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/teacher/post-assignments'); // Potentially if list is shown there
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment updated successfully.', assignment: data as Assignment };
}

export async function deleteAssignmentAction(assignmentId: string, teacherId: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  // Add dependency checks here if needed (e.g., student submissions for this assignment)
  // For now, direct delete:
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId) // Ensure teacher can only delete their own
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment deleted successfully.' };
}
