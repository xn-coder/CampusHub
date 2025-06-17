
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/post-assignments/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Assignment, UserRole } from '@/types';
import { getStudentEmailsByClassId } from '@/services/emailService';

const NO_SUBJECT_VALUE_INTERNAL = "__NO_SUBJECT__";

interface PostAssignmentInput {
  title: string;
  description?: string;
  due_date: string; // YYYY-MM-DD
  class_id: string;
  teacher_id: string; 
  subject_id?: string; 
  school_id: string;
}

export async function postAssignmentAction(
  input: PostAssignmentInput
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const assignmentId = uuidv4();
  
  const { data, error } = await supabase
    .from('assignments')
    .insert({ 
        id: assignmentId, 
        ...input,
        subject_id: (input.subject_id === NO_SUBJECT_VALUE_INTERNAL || !input.subject_id) ? null : input.subject_id,
    })
    .select('*, class:class_id(name,division), subject:subject_id(name)')
    .single();

  if (error) {
    console.error("Error posting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/post-assignments');
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments'); 

  if (data && data.class_id && data.school_id) {
    const assignment = data as Assignment & { class?: { name: string, division: string }, subject?: { name: string | null } };
    const studentEmails = await getStudentEmailsByClassId(assignment.class_id, assignment.school_id);
    
    if (studentEmails.length > 0) {
      const className = assignment.class ? `${assignment.class.name} - ${assignment.class.division}` : 'your class';
      const emailSubject = `New Assignment Posted: ${assignment.title}`;
      const emailBody = `
        <h1>New Assignment Posted</h1>
        <p>A new assignment has been posted by your teacher:</p>
        <ul>
          <li><strong>Title:</strong> ${assignment.title}</li>
          <li><strong>For Class:</strong> ${className}</li>
          ${assignment.subject?.name ? `<li><strong>Subject:</strong> ${assignment.subject.name}</li>` : ''}
          <li><strong>Due Date:</strong> ${new Date(assignment.due_date).toLocaleDateString()}</li>
        </ul>
        <p>Please log in to CampusHub to view the details and submit your work.</p>
        <p>Description: ${assignment.description || 'No description provided.'}</p>
      `;
      
      try {
        console.log(`[postAssignmentAction] Attempting to send assignment notification via API to: ${studentEmails.join(', ')}`);
        const emailApiUrl = new URL('/api/send-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002').toString();
        const apiResponse = await fetch(emailApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: studentEmails, subject: emailSubject, html: emailBody }),
        });
        const result = await apiResponse.json();
        if (!apiResponse.ok || !result.success) {
          console.error(`[postAssignmentAction] Failed to send email via API: ${result.message || apiResponse.statusText}`);
        } else {
          console.log(`[postAssignmentAction] Email successfully dispatched via API: ${result.message}`);
        }
      } catch (apiError: any) {
        console.error(`[postAssignmentAction] Error calling email API: ${apiError.message}`);
      }
    }
  }

  return { ok: true, message: 'Assignment posted successfully.', assignment: data as Assignment };
}


export async function getTeacherAssignmentsAction(teacherId: string, schoolId: string): Promise<{ ok: boolean; message?: string; assignments?: Assignment[] }> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('assignments')
        .select('*, class:class_id(name,division), subject:subject_id(name)')
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
    .eq('teacher_id', teacher_id) 
    .eq('school_id', school_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/teacher/post-assignments'); 
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment updated successfully.', assignment: data as Assignment };
}

export async function deleteAssignmentAction(assignmentId: string, teacherId: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const { count: submissionCount, error: submissionCheckError } = await supabase
    .from('lms_assignment_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .eq('school_id', schoolId);

  if (submissionCheckError) {
    console.error("Error checking assignment submissions:", submissionCheckError);
    return { ok: false, message: `Error checking dependencies: ${submissionCheckError.message}` };
  }
  if (submissionCount && submissionCount > 0) {
    return { ok: false, message: `Cannot delete assignment: It has ${submissionCount} student submission(s) associated with it.` };
  }
  
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('teacher_id', teacherId) 
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting assignment:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }
  revalidatePath('/teacher/assignment-history');
  revalidatePath('/student/assignments');
  return { ok: true, message: 'Assignment deleted successfully.' };
}
