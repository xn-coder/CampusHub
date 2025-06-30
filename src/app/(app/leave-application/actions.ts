
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { StoredLeaveApplicationDB, LeaveRequestStatus, UserRole } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function submitLeaveApplicationAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; application?: StoredLeaveApplicationDB }> {
  const supabase = createSupabaseServerClient();
  
  const studentProfileId = formData.get('studentProfileId') as string | null;
  const studentName = formData.get('studentName') as string;
  const reason = formData.get('reason') as string;
  const medicalNotesFile = formData.get('medicalNotes') as File | null;
  const applicantUserId = formData.get('applicantUserId') as string;
  const applicantRole = formData.get('applicantRole') as UserRole | 'guest';
  const schoolId = formData.get('schoolId') as string;

  if (!studentName || !reason || !applicantUserId || !applicantRole || !schoolId) {
    return { ok: false, message: "Missing required fields for leave submission." };
  }

  let medicalNotesUrl: string | undefined = undefined;
  let medicalNotesFileName: string | undefined = undefined;
  let medicalNotesFilePath: string | undefined = undefined;
  
  if (medicalNotesFile && medicalNotesFile.size > 0) {
    const sanitizedFileName = medicalNotesFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = `public/leave-applications/${schoolId}/${studentProfileId || 'guest'}/${uuidv4()}-${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('campushub') 
      .upload(filePath, medicalNotesFile);

    if (uploadError) {
      console.error("Error uploading leave application document:", uploadError);
      return { ok: false, message: `Failed to upload document: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from('campushub')
      .getPublicUrl(filePath);
      
    medicalNotesUrl = publicUrlData?.publicUrl;
    medicalNotesFileName = sanitizedFileName;
    medicalNotesFilePath = filePath;
  }

  try {
    const { data, error } = await supabase
      .from('leave_applications')
      .insert({
        student_profile_id: studentProfileId,
        student_name: studentName,
        reason: reason,
        medical_notes_url: medicalNotesUrl,
        medical_notes_file_name: medicalNotesFileName,
        medical_notes_file_path: medicalNotesFilePath,
        submission_date: new Date().toISOString(),
        status: 'Pending', // Default status is now 'Pending'
        applicant_user_id: applicantUserId,
        applicant_role: applicantRole,
        school_id: schoolId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting leave application:", error);
      // If DB insert fails, try to clean up the uploaded file
      if (medicalNotesFilePath) {
        await supabase.storage.from('campushub').remove([medicalNotesFilePath]);
      }
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/leave-application');
    revalidatePath('/teacher/leave-requests');
    revalidatePath('/admin/leave-management'); // If an admin page exists
    return { ok: true, message: 'Leave application submitted successfully. It is now pending review.', application: data as StoredLeaveApplicationDB };
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

    