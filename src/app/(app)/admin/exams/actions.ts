
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Exam, Subject, ClassData, AcademicYear } from '@/types';
import { sendEmail, getStudentEmailsByClassId, getAllUserEmailsInSchool } from '@/services/emailService'; // Assuming teacher emails are included in getAllUserEmailsInSchool with 'teacher' role

async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolId: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export async function getExamsPageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  exams?: Exam[];
  subjects?: Subject[];
  activeClasses?: ClassData[];
  academicYears?: AcademicYear[];
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [examsRes, subjectsRes, classesRes, academicYearsRes] = await Promise.all([
      supabaseAdmin.from('exams').select('*, subject:subject_id(name), class:class_id(name,division)').eq('school_id', schoolId).order('date', { ascending: false }), // Eager load subject and class for notifications
      supabaseAdmin.from('subjects').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);

    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (academicYearsRes.error) throw new Error(`Fetching academic years failed: ${academicYearsRes.error.message}`);

    return {
      ok: true,
      schoolId,
      exams: examsRes.data || [],
      subjects: subjectsRes.data || [],
      activeClasses: classesRes.data || [],
      academicYears: academicYearsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getExamsPageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

interface ExamInput {
  name: string;
  subject_id: string;
  class_id?: string | null; 
  academic_year_id?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  max_marks?: number | null;
  school_id: string;
}

export async function addExamAction(
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examId = uuidv4();
  
  const examData = {
    ...input,
    id: examId,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };

  const { error, data } = await supabaseAdmin
    .from('exams')
    .insert(examData)
    .select('*, subject:subject_id(name), class:class_id(name,division)') // Eager load for notification
    .single();

  if (error) {
    console.error("Error adding exam:", error);
    return { ok: false, message: `Failed to add exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');

  // Send email notification
  if (data) {
    const exam = data as Exam & { subject?: { name: string }, class?: { name: string, division: string } };
    const subjectName = exam.subject?.name || 'N/A';
    const className = exam.class ? `${exam.class.name} - ${exam.class.division}` : 'All Classes';
    
    const emailSubject = `New Exam Scheduled: ${exam.name} for ${subjectName}`;
    const emailBody = `
      <h1>New Exam Scheduled</h1>
      <p>An exam has been scheduled:</p>
      <ul>
        <li><strong>Exam Name:</strong> ${exam.name}</li>
        <li><strong>Subject:</strong> ${subjectName}</li>
        <li><strong>Class:</strong> ${className}</li>
        <li><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString()}</li>
        ${exam.start_time ? `<li><strong>Time:</strong> ${exam.start_time}${exam.end_time ? ` - ${exam.end_time}` : ''}</li>` : ''}
        ${exam.max_marks ? `<li><strong>Max Marks:</strong> ${exam.max_marks}</li>` : ''}
      </ul>
      <p>Please prepare accordingly.</p>
    `;
    
    let recipientEmails: string[] = [];
    if (exam.class_id && exam.school_id) {
      recipientEmails = await getStudentEmailsByClassId(exam.class_id, exam.school_id);
      // Potentially add teacher emails for this class/subject
    } else if (exam.school_id) {
      // If exam is not class-specific (e.g. general), notify all students and teachers
      recipientEmails = await getAllUserEmailsInSchool(exam.school_id, ['student', 'teacher']);
    }

    if (recipientEmails.length > 0) {
      await sendEmail({
        to: recipientEmails,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }

  return { ok: true, message: 'Exam scheduled successfully.', exam: data as Exam };
}

export async function updateExamAction(
  id: string,
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  const examData = {
    ...input,
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
  };
  // school_id is not updated, it's part of the query scope.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { school_id, ...updatePayload } = examData;


  const { error, data } = await supabaseAdmin
    .from('exams')
    .update(updatePayload)
    .eq('id', id)
    .eq('school_id', input.school_id)
    .select('*, subject:subject_id(name), class:class_id(name,division)')
    .single();

  if (error) {
    console.error("Error updating exam:", error);
    return { ok: false, message: `Failed to update exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');

  // Optionally, send update notification emails here, similar to addExamAction
  if (data) {
    const exam = data as Exam & { subject?: { name: string }, class?: { name: string, division: string } };
    const subjectName = exam.subject?.name || 'N/A';
    const className = exam.class ? `${exam.class.name} - ${exam.class.division}` : 'All Classes';
    
    const emailSubject = `Exam Updated: ${exam.name} for ${subjectName}`;
    const emailBody = `
      <h1>Exam Schedule Updated</h1>
      <p>Details for the following exam have been updated:</p>
      <ul>
        <li><strong>Exam Name:</strong> ${exam.name}</li>
        <li><strong>Subject:</strong> ${subjectName}</li>
        <li><strong>Class:</strong> ${className}</li>
        <li><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString()}</li>
        ${exam.start_time ? `<li><strong>Time:</strong> ${exam.start_time}${exam.end_time ? ` - ${exam.end_time}` : ''}</li>` : ''}
        ${exam.max_marks ? `<li><strong>Max Marks:</strong> ${exam.max_marks}</li>` : ''}
      </ul>
      <p>Please review the changes.</p>
    `;
    
    let recipientEmails: string[] = [];
    if (exam.class_id && exam.school_id) {
      recipientEmails = await getStudentEmailsByClassId(exam.class_id, exam.school_id);
    } else if (exam.school_id) {
      recipientEmails = await getAllUserEmailsInSchool(exam.school_id, ['student', 'teacher']);
    }

    if (recipientEmails.length > 0) {
      await sendEmail({
        to: recipientEmails,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }

  return { ok: true, message: 'Exam updated successfully.', exam: data as Exam };
}

export async function deleteExamAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
  // Check for dependencies (e.g., student_scores)
  const { count, error: depError } = await supabaseAdmin
    .from('student_scores')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', id)
    .eq('school_id', schoolId);

  if (depError) {
    console.error("Error checking exam dependencies (student_scores):", depError);
    return { ok: false, message: `Error checking dependencies: ${depError.message}` };
  }
  if (count && count > 0) {
    return { ok: false, message: `Cannot delete exam: It has ${count} student score(s) associated with it.` };
  }

  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { ok: false, message: `Failed to delete exam: ${error.message}` };
  }
  revalidatePath('/admin/exams');
  // Optionally, send cancellation notification emails here
  return { ok: true, message: 'Exam deleted successfully.' };
}
    