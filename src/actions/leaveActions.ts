
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { StoredLeaveApplicationDB, UserRole, LeaveRequestStatus } from '@/types';

interface SubmitLeaveApplicationInput {
  student_profile_id?: string;
  student_name: string;
  reason: string;
  medical_notes_data_uri?: string;
  applicant_user_id: string;
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
        submission_date: new Date().toISOString(),
        status: 'Pending', // All requests are now pending admin approval
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
    revalidatePath('/student/leave-history');
    revalidatePath('/admin/leave-management');
    return { ok: true, message: 'Leave application submitted successfully for review.', application: data as StoredLeaveApplicationDB };
  } catch (e: any) {
    console.error("Unexpected error submitting leave application:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

interface GetLeaveRequestsParams {
  school_id: string;
  teacher_id?: string; // For teacher role to get students in their classes
  student_profile_id?: string; // For student role
  applicant_user_id?: string; // For fetching a specific user's own requests (e.g., a teacher)
  target_role?: 'student' | 'teacher';
}

// Fetches leave requests.
export async function getLeaveRequestsAction(params: GetLeaveRequestsParams): Promise<{ ok: boolean; message?: string; applications?: StoredLeaveApplicationDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, teacher_id, student_profile_id, applicant_user_id, target_role } = params;

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

    if (target_role) {
      query = query.eq('applicant_role', target_role);
    }
    if(applicant_user_id) {
        query = query.eq('applicant_user_id', applicant_user_id);
    }

    if (target_role === 'student') {
      if (student_profile_id) {
        query = query.eq('student_profile_id', student_profile_id);
      } else if (teacher_id) {
        const { data: teacherClasses, error: classesError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', teacher_id)
          .eq('school_id', school_id);

        if (classesError) throw classesError;
        const teacherClassIds = (teacherClasses || []).map(c => c.id);
        if (teacherClassIds.length === 0) return { ok: true, applications: [] };

        const { data: studentsInClasses, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .in('class_id', teacherClassIds)
          .eq('school_id', school_id);
        
        if (studentsError) throw studentsError;
        const studentProfileIdsInTeacherClasses = (studentsInClasses || []).map(s => s.id);
        if (studentProfileIdsInTeacherClasses.length === 0) return { ok: true, applications: [] };

        query = query.in('student_profile_id', studentProfileIdsInTeacherClasses);
      }
    }

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

interface UpdateLeaveStatusInput {
  requestId: string;
  status: 'Approved' | 'Rejected';
  schoolId: string;
}

export async function updateLeaveStatusAction(input: UpdateLeaveStatusInput): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  const { requestId, status, schoolId } = input;
  
  const { error } = await supabase
    .from('leave_applications')
    .update({ status })
    .eq('id', requestId)
    .eq('school_id', schoolId);
    
  if (error) {
    console.error("Error updating leave status:", error);
    return { ok: false, message: `Database error: ${error.message}` };
  }

  revalidatePath('/admin/leave-management');
  revalidatePath('/teacher/leave-requests');
  revalidatePath('/student/leave-history');
  revalidatePath('/leave-application'); // For the applicant

  return { ok: true, message: `Leave request status updated to ${status}.` };
}
