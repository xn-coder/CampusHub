
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Assignment, Student, Teacher, Subject, AssignmentSubmission } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';

interface EnrichedAssignment extends Assignment {
  teacherName?: string;
  subjectName?: string;
  submission?: AssignmentSubmission | null;
}

export async function getStudentAssignmentsAction(userId: string): Promise<{
  ok: boolean;
  assignments?: EnrichedAssignment[];
  message?: string;
  studentProfileId?: string | null;
  studentClassId?: string | null;
  studentSchoolId?: string | null;
}> {
  if (!userId) {
    return { ok: false, message: "User not identified.", studentProfileId: null, studentClassId: null, studentSchoolId: null };
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, school_id') // students.id is the student_profile_id
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData) {
      return {
        ok: false,
        message: studentError?.message || "Student profile not found. Ensure you are logged in as a student and your profile is set up.",
        studentProfileId: null, studentClassId: null, studentSchoolId: null,
      };
    }

    const { id: studentProfileId, class_id: studentClassId, school_id: studentSchoolId } = studentData;

    if (!studentSchoolId || !studentClassId) {
      return {
        ok: true, assignments: [],
        message: "Student not assigned to a class or school. Assignments cannot be displayed.",
        studentProfileId, studentClassId, studentSchoolId,
      };
    }

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('assignments')
      .select('*')
      .eq('class_id', studentClassId)
      .eq('school_id', studentSchoolId);

    if (assignmentsError) {
      return {
        ok: false, message: `Failed to fetch assignments: ${assignmentsError.message}`,
        studentProfileId, studentClassId, studentSchoolId,
      };
    }

    if (!assignmentsData || assignmentsData.length === 0) {
      return { ok: true, assignments: [], studentProfileId, studentClassId, studentSchoolId };
    }

    // Fetch submissions for these assignments by this student
    const assignmentIds = assignmentsData.map(a => a.id);
    const { data: submissionsData, error: submissionsError } = await supabase
      .from('lms_assignment_submissions')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('student_id', studentProfileId)
      .eq('school_id', studentSchoolId);

    if (submissionsError) {
      console.warn("Failed to fetch assignment submissions:", submissionsError.message);
      // Continue without submission data if it fails
    }

    const teacherIds = [...new Set(assignmentsData.map(a => a.teacher_id).filter(Boolean))];
    const subjectIds = [...new Set(assignmentsData.map(a => a.subject_id).filter(Boolean))];

    let teachers: Pick<Teacher, 'id' | 'name'>[] = [];
    if (teacherIds.length > 0) {
        const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, name')
        .in('id', teacherIds);
        if (teachersError) console.error("Error fetching teachers for assignments:", teachersError);
        else teachers = teachersData || [];
    }

    let subjects: Pick<Subject, 'id' | 'name'>[] = [];
    if (subjectIds.length > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
        if (subjectsError) console.error("Error fetching subjects for assignments:", subjectsError);
        else subjects = subjectsData || [];
    }

    const enrichedAssignments: EnrichedAssignment[] = assignmentsData.map(asm => {
      const submission = (submissionsData || []).find(sub => sub.assignment_id === asm.id);
      return {
        ...asm,
        teacherName: teachers.find(t => t.id === asm.teacher_id)?.name || 'N/A',
        subjectName: asm.subject_id ? subjects.find(s => s.id === asm.subject_id)?.name : undefined,
        submission: submission || null,
      };
    });

    return {
      ok: true,
      assignments: enrichedAssignments,
      studentProfileId, studentClassId, studentSchoolId,
    };

  } catch (error: any) {
    return {
      ok: false, message: `An unexpected error occurred: ${error.message}`,
      studentProfileId: null, studentClassId: null, studentSchoolId: null,
    };
  }
}


export async function submitAssignmentFileAction(formData: FormData): Promise<{
  ok: boolean;
  message: string;
  submission?: AssignmentSubmission;
}> {
  const supabase = createSupabaseServerClient(); 

  const file = formData.get('submissionFile') as File | null;
  const assignmentId = formData.get('assignmentId') as string | null;
  const studentId = formData.get('studentId') as string | null; 
  const schoolId = formData.get('schoolId') as string | null;
  const notes = formData.get('notes') as string | null;

  if (!file || !assignmentId || !studentId || !schoolId) {
    return { ok: false, message: "Missing required data for submission." };
  }

  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filePath = `public/assignment_submissions/${schoolId}/${studentId}/${assignmentId}/${uuidv4()}-${sanitizedFileName}`;

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assignment_submissions') 
      .upload(filePath, file);

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return { ok: false, message: `Failed to upload file: ${uploadError.message}` };
    }

    const submissionData = {
      assignment_id: assignmentId,
      student_id: studentId,
      school_id: schoolId,
      submission_date: new Date().toISOString(),
      file_path: filePath, 
      file_name: sanitizedFileName,
      notes: notes || undefined,
    };

    const { data: dbData, error: dbError } = await supabase
      .from('lms_assignment_submissions') 
      .insert(submissionData)
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error for submission:", dbError);
      await supabase.storage.from('assignment_submissions').remove([filePath]);
      return { ok: false, message: `Failed to record submission: ${dbError.message}` };
    }
    
    revalidatePath('/student/assignments'); 

    return { ok: true, message: "Assignment submitted successfully!", submission: dbData as AssignmentSubmission };

  } catch (error: any) {
    console.error("Unexpected error in submitAssignmentFileAction:", error);
    return { ok: false, message: `An unexpected error occurred: ${error.message}` };
  }
}

