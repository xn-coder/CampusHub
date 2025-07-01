'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { StoredLeaveApplicationDB, UserRole } from '@/types';
import { leaveApplicationApproval } from '@/ai/flows/leave-application-approval';

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
    // Call the AI flow to get approval status
    const aiResult = await leaveApplicationApproval({
      reason: input.reason,
      medicalNotesDataUri: input.medical_notes_data_uri,
    });

    const { data, error } = await supabase
      .from('leave_applications')
      .insert({
        student_profile_id: input.student_profile_id,
        student_name: input.student_name,
        reason: input.reason,
        medical_notes_data_uri: input.medical_notes_data_uri,
        submission_date: new Date().toISOString(),
        status: aiResult.approved ? 'Approved' : 'Rejected',
        ai_reasoning: aiResult.reasoning,
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
  target_role?: 'student' | 'teacher';
}

// Fetches leave requests. For teachers, it fetches for students in their classes.
// For students, it fetches their own. For admins, it fetches all for the school.
export async function getLeaveRequestsAction(params: GetLeaveRequestsParams): Promise<{ ok: boolean; message?: string; applications?: StoredLeaveApplicationDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, teacher_id, student_profile_id, target_role = 'student' } = params;

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

    // Filter by the role of the applicant (student or teacher)
    if (target_role) {
      query = query.eq('applicant_role', target_role);
    }

    // Additional filtering for fetching student leaves specifically
    if (target_role === 'student') {
      if (student_profile_id) {
        // A student fetching their own history
        query = query.eq('student_profile_id', student_profile_id);
      } else if (teacher_id) {
        // A teacher fetching leave requests for students in their classes
        const { data: teacherClasses, error: classesError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', teacher_id)
          .eq('school_id', school_id);

        if (classesError) throw classesError;
        const teacherClassIds = (teacherClasses || []).map(c => c.id);

        if (teacherClassIds.length === 0) {
          return { ok: true, applications: [] }; // Teacher has no classes
        }

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
        query = query.in('student_profile_id', studentProfileIdsInTeacherClasses);
      }
    }
    // For an admin fetching teacher leaves, no further filters are needed beyond school_id and target_role.
    // For an admin fetching all student leaves, no further filters are needed either.

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
