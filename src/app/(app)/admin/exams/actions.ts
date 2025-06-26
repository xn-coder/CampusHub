
'use server';

console.log('[LOG] Loading src/app/(app)/admin/exams/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Exam, Subject, ClassData, AcademicYear, UserRole } from '@/types';
import { getStudentEmailsByClassId, getAllUserEmailsInSchool } from '@/services/emailService';

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
      supabaseAdmin.from('exams').select('*, subject:subject_id(name), class:class_id(name,division)').eq('school_id', schoolId).order('date', { ascending: false }),
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
  publish_date?: string | null; // ISO string
}

export async function addExamAction(
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  // The input from the client component (`page.tsx`) is already processed.
  // We can trust it and simplify this part.
  const examData = {
    ...input,
    id: uuidv4(),
  };

  const { error, data } = await supabaseAdmin
    .from('exams')
    .insert(examData)
    .select('*, subject:subject_id(name), class:class_id(name,division)')
    .single();

  if (error) {
    if (error.code === '23505') { // Handle unique constraint violation
      return { ok: false, message: `Failed to add exam for subject: An exam with these details (name, subject, class) likely already exists.` };
    }
    console.error("Error adding exam:", error);
    return { ok: false, message: `Failed to add exam: ${error.message}` };
  }

  revalidatePath('/admin/exams');

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
        ${exam.publish_date ? `<li><strong>Results will be published on:</strong> ${new Date(exam.publish_date).toLocaleString()}</li>` : ''}
      </ul>
      <p>Please prepare accordingly.</p>
    `;
    
    let recipientEmails: string[] = [];
    if (exam.class_id && exam.school_id) {
      recipientEmails = await getStudentEmailsByClassId(exam.class_id, exam.school_id);
    } else if (exam.school_id) {
      recipientEmails = await getAllUserEmailsInSchool(exam.school_id, ['student', 'teacher']);
    }

    if (recipientEmails.length > 0) {
       try {
          console.log(`[addExamAction] Attempting to send exam notification via API to: ${recipientEmails.join(', ')}`);
          const emailApiUrl = new URL('/api/send-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002').toString();
          const apiResponse = await fetch(emailApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: recipientEmails, subject: emailSubject, html: emailBody }),
          });
          const result = await apiResponse.json();
          if (!apiResponse.ok || !result.success) {
            console.error(`[addExamAction] Failed to send email via API: ${result.message || apiResponse.statusText}`);
          } else {
            console.log(`[addExamAction] Email successfully dispatched via API: ${result.message}`);
          }
        } catch (apiError: any) {
          console.error(`[addExamAction] Error calling email API: ${apiError.message}`);
        }
    }
  }

  return { ok: true, message: 'Exam scheduled successfully.', exam: data as Exam };
}

export async function updateExamAction(
  id: string,
  input: ExamInput
): Promise<{ ok: boolean; message: string; exam?: Exam }> {
  const supabaseAdmin = createSupabaseServerClient();
  
  const updatePayload = {
    name: input.name,
    // Do not update subject_id
    class_id: input.class_id === 'none_cs_selection' ? null : input.class_id,
    academic_year_id: input.academic_year_id === 'none_ay_selection' ? null : input.academic_year_id,
    date: input.date,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    max_marks: input.max_marks === undefined || input.max_marks === null || isNaN(Number(input.max_marks)) ? null : Number(input.max_marks),
    publish_date: input.publish_date || null,
  };

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

  // Email notification logic can be added here similar to addExamAction if needed

  return { ok: true, message: 'Exam updated successfully.', exam: data as Exam };
}

export async function deleteExamAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabaseAdmin = createSupabaseServerClient();
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
  return { ok: true, message: 'Exam deleted successfully.' };
}
