'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { StoredLeaveApplicationDB, LeaveRequestStatus, UserRole } from '@/types'; // Assume StoredLeaveApplicationDB is for DB schema

// This type aligns with what leave-form.tsx might submit and what gets stored.
// Ensure your StoredLeaveApplicationDB type in types/index.ts matches the DB table.
interface SubmitLeaveApplicationInput {
  student_profile_id?: string; // ID of student if student applied
  student_name: string; // Name of supatudent
  reason: string;
  medical_notes_data_uri?: string;
  status: LeaveRequestStatus; // Approved, Rejected
  ai_reasoning?: string;
  applicant_user_id: string; // User who submitted
  applicant_role: UserRole | 'guest';
  school_id: string;
}

export async function submitLeaveApplicationAction(
  input: SubmitLeaveApplicationInput
): Promise<{ ok: boolean; message: string; application?: StoredLeaveApplicationDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('leave_applications')
      .insert({
        student_profile_id: input.student_profile_id,
        student_name: input.student_name,
        reason: input.reason,
        medical_notes_data_uri: input.medical_notes_data_uri,
        submission_date: new Date().toISOString(), // Handled by DB default if set
        status: input.status,
        ai_reasoning: input.ai_reasoning,
        applicant_user_id: input.applicant_user_id,
        applicant_role: input.applicant_role,
        school_id: input.school_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting leave application:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/leave-application');
    revalidatePath('/teacher/leave-requests');
    revalidatePath('/admin/leave-management'); // If an admin page exists
    return { ok: true, message: 'Leave application submitted successfully.', application: data as StoredLeaveApplicationDB };
  } catch (e: any) {
    console.error("Unexpected error submitting leave application:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

interface GetLeaveRequestsParams {
  school_id: string;
  teacher_id?: string; // For teacher role to get students in their classes
  student_profile_id?: string; // For student role
  // Admin might not need teacher_id or student_profile_id if they see all for school_id
}

// Fetches leave requests. For teachers, it fetches for students in their classes.
// For students, it fetches their own. For admins, it fetches all for the school.
export async function getLeaveRequestsAction(params: GetLeaveRequestsParams): Promise<{ ok: boolean; message?: string; applications?: StoredLeaveApplicationDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, teacher_id, student_profile_id } = params;

  try {
    let query = supabase
      .from('leave_applications')
      .select(`
        *,
        applicant:applicant_user_id ( name, email ),
        student:student_profile_id ( name, email, class_id )
      `)
      .eq('school_id', school_id)
      .order('submission_date', { ascending: false });

    if (student_profile_id) {
      query = query.eq('student_profile_id', student_profile_id);
    } else if (teacher_id) {
      // Fetch classes taught by this teacher
      const { data: teacherClasses, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', teacher_id)
        .eq('school_id', school_id);

      if (classesError) throw classesError;
      const teacherClassIds = (teacherClasses || []).map(c => c.id);

      if (teacherClassIds.length === 0) {
        return { ok: true, applications: [] }; // Teacher has no classes, so no relevant leave requests
      }

      // Fetch students in those classes
      const { data: studentsInClasses, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .in('class_id', teacherClassIds)
        .eq('school_id', school_id);
      
      if (studentsError) throw studentsError;
      const studentProfileIdsInTeacherClasses = (studentsInClasses || []).map(s => s.id);

      if (studentProfileIdsInTeacherClasses.length === 0) {
        return { ok: true, applications: [] }; // No students in teacher's classes
      }
      // Filter leave applications by these student profile IDs
      query = query.in('student_profile_id', studentProfileIdsInTeacherClasses);
    }
    // For admin, no additional filtering by student/teacher needed beyond school_id

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching leave applications:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, applications: data as StoredLeaveApplicationDB[] };
  } catch (e: any) {
    console.error("Unexpected error fetching leave applications:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
