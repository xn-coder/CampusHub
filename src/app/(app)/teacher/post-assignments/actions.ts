
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/post-assignments/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Assignment, UserRole, ClassData, Subject } from '@/types';
import { getStudentEmailsByClassId, sendEmail } from '@/services/emailService';

const NO_SUBJECT_VALUE_INTERNAL = "__NO_SUBJECT__";

export async function getTeacherPostAssignmentDataAction(teacherUserId: string): Promise<{
    ok: boolean;
    message?: string;
    teacherProfileId?: string;
    schoolId?: string;
    assignedClasses?: ClassData[];
    allSubjects?: Subject[];
}> {
    if (!teacherUserId) {
        return { ok: false, message: "Teacher user ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data: teacherProfile, error: profileError } = await supabase
            .from('teachers')
            .select('id, school_id')
            .eq('user_id', teacherUserId)
            .single();

        if (profileError || !teacherProfile) {
            return { ok: false, message: profileError?.message || "Teacher profile not found." };
        }
        const { id: teacherProfileId, school_id: schoolId } = teacherProfile;
        if (!schoolId) {
            return { ok: false, message: "Teacher is not associated with a school." };
        }

        const [classesRes, subjectsRes] = await Promise.all([
            supabase.from('classes').select('*').eq('teacher_id', teacherProfileId).eq('school_id', schoolId),
            supabase.from('subjects').select('*').eq('school_id', schoolId)
        ]);

        if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
        if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
        
        return {
            ok: true,
            teacherProfileId,
            schoolId,
            assignedClasses: (classesRes.data || []) as ClassData[],
            allSubjects: (subjectsRes.data || []) as Subject[],
        };
    } catch (e: any) {
        console.error("Error in getTeacherPostAssignmentDataAction:", e);
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}


export async function postAssignmentAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; assignment?: Assignment }> {
  const supabase = createSupabaseServerClient();
  const assignmentId = uuidv4();
  
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const due_date = formData.get('due_date') as string;
  const class_id = formData.get('class_id') as string;
  const teacher_id = formData.get('teacher_id') as string;
  const subject_id = formData.get('subject_id') as string;
  const school_id = formData.get('school_id') as string;
  const attachment = formData.get('attachment') as File | null;
  
  let attachment_url: string | undefined = undefined;
  let attachment_name: string | undefined = undefined;
  
  try {
    if (attachment && attachment.size > 0) {
      const sanitizedFileName = attachment.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `public/assignment-attachments/${school_id}/${class_id}/${assignmentId}/${sanitizedFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('campushub')
        .upload(filePath, attachment);

      if (uploadError) {
        throw new Error(`Attachment upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from('campushub').getPublicUrl(filePath);
      attachment_url = publicUrlData?.publicUrl;
      attachment_name = sanitizedFileName;
    }
  
    const { data, error } = await supabase
      .from('assignments')
      .insert({ 
          id: assignmentId, 
          title, description, due_date, class_id, teacher_id, school_id,
          subject_id: (subject_id === NO_SUBJECT_VALUE_INTERNAL || !subject_id) ? null : subject_id,
          attachment_url: attachment_url,
          attachment_name: attachment_name,
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
          console.log(`[postAssignmentAction] Attempting to send assignment notification via email service to: ${studentEmails.join(', ')}`);
          const result = await sendEmail({ to: studentEmails, subject: emailSubject, html: emailBody });
          if (!result.ok) {
            console.error(`[postAssignmentAction] Failed to send email via service: ${result.message}`);
          } else {
            console.log(`[postAssignmentAction] Email successfully dispatched via service: ${result.message}`);
          }
        } catch (apiError: any) {
          console.error(`[postAssignmentAction] Error calling email service: ${apiError.message}`);
        }
      }
    }

    return { ok: true, message: 'Assignment posted successfully.', assignment: data as Assignment };
  } catch (e: any) {
    console.error("Unexpected error in postAssignmentAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}


export async function getTeacherAssignmentsAction(teacherUserId: string): Promise<{ 
    ok: boolean; 
    message?: string; 
    assignments?: Assignment[];
    teacherProfileId?: string;
    schoolId?: string;
}> {
    const supabase = createSupabaseServerClient();

    try {
        const { data: teacherProfile, error: profileError } = await supabase
            .from('teachers')
            .select('id, school_id')
            .eq('user_id', teacherUserId)
            .single();

        if (profileError || !teacherProfile) {
            return { ok: false, message: profileError?.message || "Teacher profile not found." };
        }
        
        const { id: teacherProfileId, school_id: schoolId } = teacherProfile;

        if (!schoolId) {
            return { ok: false, message: "Teacher is not associated with a school." };
        }

        const { data, error } = await supabase
            .from('assignments')
            .select('*, class:class_id(name,division), subject:subject_id(name)')
            .eq('teacher_id', teacherProfileId)
            .eq('school_id', schoolId)
            .order('due_date', { ascending: false });

        if (error) {
            console.error("Error fetching assignments:", error);
            return { ok: false, message: `Database error: ${error.message}` };
        }
        
        return { 
            ok: true, 
            assignments: (data || []) as Assignment[],
            teacherProfileId,
            schoolId,
        };

    } catch (e: any) {
        console.error("Unexpected error fetching assignments:", e);
        return { ok: false, message: `Unexpected error: ${e.message}` };
    }
}

interface UpdateAssignmentInput extends Omit<Partial<any>, 'teacher_id' | 'school_id'> {
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
