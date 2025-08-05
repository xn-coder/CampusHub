
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/grade-assignments/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Assignment, AssignmentSubmission, Student } from '@/types';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/services/emailService';

interface EnrichedSubmission extends AssignmentSubmission {
  student_name: string;
  student_email: string;
}

export async function getTeacherAssignmentsForGradingAction(teacherUserId: string): Promise<{
  ok: boolean;
  assignments?: Assignment[];
  teacherProfileId?: string;
  schoolId?: string;
  message?: string;
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

    if (profileError || !teacherProfile || !teacherProfile.id || !teacherProfile.school_id) {
      return { ok: false, message: profileError?.message || "Could not load teacher profile." };
    }

    const { id: teacherProfileId, school_id: schoolId } = teacherProfile;

    const { data, error } = await supabase
      .from('assignments')
      .select('*, subject:subject_id(name), class:class_id(name,division)')
      .eq('teacher_id', teacherProfileId)
      .eq('school_id', schoolId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error("Error fetching teacher's assignments for grading:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { 
        ok: true, 
        assignments: (data || []) as Assignment[],
        teacherProfileId,
        schoolId
    };
  } catch (e: any) {
    console.error("Unexpected error fetching assignments:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function getSubmissionsForAssignmentAction(assignmentId: string, schoolId: string): Promise<{
  ok: boolean;
  submissions?: EnrichedSubmission[];
  message?: string;
}> {
  if (!assignmentId || !schoolId) {
    return { ok: false, message: "Assignment ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: submissionsData, error: submissionsError } = await supabase
      .from('lms_assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('school_id', schoolId);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return { ok: false, message: `Database error fetching submissions: ${submissionsError.message}` };
    }
    if (!submissionsData || submissionsData.length === 0) {
      return { ok: true, submissions: [] };
    }

    const studentIds = submissionsData.map(s => s.student_id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, email')
      .in('id', studentIds)
      .eq('school_id', schoolId);
    
    if (studentsError) {
      console.error("Error fetching student details for submissions:", studentsError);
      return { ok: false, message: `Database error fetching student details: ${studentsError.message}` };
    }

    const enrichedSubmissions: EnrichedSubmission[] = submissionsData.map(sub => {
      const student = studentsData?.find(s => s.id === sub.student_id);
      return {
        ...sub,
        student_name: student?.name || 'Unknown Student',
        student_email: student?.email || 'N/A',
      };
    });

    return { ok: true, submissions: enrichedSubmissions };
  } catch (e: any) {
    console.error("Unexpected error fetching submissions:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}


interface SaveGradeInput {
    submission_id: string;
    grade: string;
    feedback?: string | null;
    school_id: string; 
}

export async function saveSingleGradeAndFeedbackAction(input: SaveGradeInput): Promise<{
  ok: boolean;
  message: string;
  updatedSubmission?: AssignmentSubmission;
}> {
  const supabase = createSupabaseServerClient();
  const { submission_id, grade, feedback, school_id } = input;

  if (!submission_id || !grade) {
    return { ok: false, message: "Submission ID and Grade are required." };
  }

  try {
    const { data, error } = await supabase
      .from('lms_assignment_submissions')
      .update({
        grade: grade.trim(),
        feedback: feedback?.trim() || null,
      })
      .eq('id', submission_id)
      .eq('school_id', school_id)
      .select('*, student:student_id(email), assignment:assignment_id(title)') 
      .single();

    if (error) {
      console.error("Error saving grade and feedback:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    
    revalidatePath('/teacher/grade-assignments');
    revalidatePath(`/student/assignments`); 

    if (data) {
      const submission = data as AssignmentSubmission & { student?: { email: string | null } | null, assignment?: { title: string | null } | null };
      if (submission.student?.email && submission.assignment?.title) {
        const emailSubject = `Assignment Graded: ${submission.assignment.title}`;
        const emailBody = `
          <h1>Assignment Graded</h1>
          <p>Your submission for the assignment "<strong>${submission.assignment.title}</strong>" has been graded.</p>
          <p><strong>Grade:</strong> ${submission.grade}</p>
          ${submission.feedback ? `<p><strong>Feedback:</strong> ${submission.feedback}</p>` : ''}
          <p>Please log in to CampusHub to view details.</p>
        `;
        
        try {
          console.log(`[saveSingleGradeAndFeedbackAction] Attempting to send grade notification via email service to: ${submission.student.email}`);
          const result = await sendEmail({ to: submission.student.email, subject: emailSubject, html: emailBody });
          if (!result.ok) {
            console.error(`[saveSingleGradeAndFeedbackAction] Failed to send email via service: ${result.message}`);
          } else {
            console.log(`[saveSingleGradeAndFeedbackAction] Email successfully dispatched via service: ${result.message}`);
          }
        } catch (apiError: any) {
          console.error(`[saveSingleGradeAndFeedbackAction] Error calling email service: ${apiError.message}`);
        }
      }
    }

    return { ok: true, message: 'Grade and feedback saved successfully.', updatedSubmission: data as AssignmentSubmission };
  } catch (e: any) {
    console.error("Unexpected error saving grade:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

    
