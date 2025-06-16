
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Assignment, AssignmentSubmission, Student } from '@/types';
import { revalidatePath } from 'next/cache';

interface EnrichedSubmission extends AssignmentSubmission {
  student_name: string;
  student_email: string;
}

export async function getTeacherAssignmentsForGradingAction(teacherId: string, schoolId: string): Promise<{
  ok: boolean;
  assignments?: Assignment[];
  message?: string;
}> {
  if (!teacherId || !schoolId) {
    return { ok: false, message: "Teacher ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subject:subject_id(name), class:class_id(name,division)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error("Error fetching teacher's assignments for grading:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, assignments: (data || []) as Assignment[] };
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
    // Fetch submissions
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

    // Fetch student details for these submissions
    const studentIds = submissionsData.map(s => s.student_id);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, email')
      .in('id', studentIds)
      .eq('school_id', schoolId);
    
    if (studentsError) {
      console.error("Error fetching student details for submissions:", studentsError);
      // Return submissions without student names if student fetch fails, or handle error differently
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
    school_id: string; // For RLS or scoping, if needed
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
      .eq('school_id', school_id) // Ensure teacher can only grade within their school
      .select()
      .single();

    if (error) {
      console.error("Error saving grade and feedback:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    
    revalidatePath('/teacher/grade-assignments'); // Revalidate the grading page
    // Optionally revalidate student's view if they can see grades immediately
    // revalidatePath(`/student/assignments`); 

    return { ok: true, message: 'Grade and feedback saved successfully.', updatedSubmission: data as AssignmentSubmission };
  } catch (e: any) {
    console.error("Unexpected error saving grade:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
