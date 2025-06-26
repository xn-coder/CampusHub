
'use server';

console.log('[LOG] Loading src/app/(app)/teacher/student-scores/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { ClassData, Exam, Student, Subject } from '@/types';

interface SaveScoreInput {
  student_id: string;
  exam_id: string;
  subject_id: string; 
  class_id: string;
  score: string | number;
  max_marks?: number | null;
  recorded_by_teacher_id: string; 
  school_id: string;
}

export async function getTeacherStudentScoresPageInitialDataAction(teacherUserId: string): Promise<{
  ok: boolean;
  message?: string;
  teacherProfileId?: string;
  schoolId?: string;
  assignedClasses?: ClassData[];
  allExams?: Exam[];
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

    const [classesRes, examsRes, subjectsRes] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', teacherProfileId).eq('school_id', schoolId),
      supabase.from('exams').select('*').eq('school_id', schoolId),
      supabase.from('subjects').select('*').eq('school_id', schoolId),
    ]);

    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (examsRes.error) throw new Error(`Fetching exams failed: ${examsRes.error.message}`);
    if (subjectsRes.error) throw new Error(`Fetching subjects failed: ${subjectsRes.error.message}`);
    
    return {
      ok: true,
      teacherProfileId,
      schoolId,
      assignedClasses: (classesRes.data || []) as ClassData[],
      allExams: (examsRes.data || []) as Exam[],
      allSubjects: (subjectsRes.data || []) as Subject[],
    };

  } catch (error: any) {
    console.error("Error in getTeacherStudentScoresPageInitialDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function getStudentsForClassAction(classId: string, schoolId: string): Promise<{
  ok: boolean;
  message?: string;
  students?: Student[];
}> {
  if (!classId || !schoolId) {
    return { ok: false, message: "Class ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('name');
    
    if (error) throw error;
    return { ok: true, students: (data || []) as Student[] };
  } catch (error: any) {
    console.error("Error in getStudentsForClassAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function getScoresForExamAndStudentAction(
  examId: string,
  studentId: string,
  schoolId: string,
): Promise<{
  ok: boolean;
  message?: string;
  scores?: Record<string, string | number>; // subjectId: score
}> {
  if (!examId || !studentId || !schoolId) {
    return { ok: true, scores: {} }; 
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: fetchedScoresData, error } = await supabase
      .from('student_scores')
      .select('subject_id, score')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .eq('school_id', schoolId);

    if (error) throw error;

    const scoresMap: Record<string, string | number> = {};
    (fetchedScoresData || []).forEach(fetchedScore => {
      scoresMap[fetchedScore.subject_id] = fetchedScore.score;
    });
    return { ok: true, scores: scoresMap };
  } catch (error: any) {
    console.error("Error in getScoresForExamAndStudentAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function saveStudentScoresAction(scoresToSave: SaveScoreInput[]): Promise<{ ok: boolean; message: string; savedCount: number }> {
  const supabaseAdmin = createSupabaseServerClient();
  if (!scoresToSave || scoresToSave.length === 0) {
    return { ok: true, message: 'No scores provided to save.', savedCount: 0 };
  }

  let savedCount = 0;
  const errors: string[] = [];

  for (const scoreInput of scoresToSave) {
    const { data: existingRecord, error: fetchError } = await supabaseAdmin
      .from('student_scores')
      .select('id')
      .eq('student_id', scoreInput.student_id)
      .eq('exam_id', scoreInput.exam_id)
      .eq('subject_id', scoreInput.subject_id)
      .maybeSingle();

    if (fetchError) {
      console.error(`Error checking existing score for student ${scoreInput.student_id}, subject ${scoreInput.subject_id}:`, fetchError);
      errors.push(`DB error for subject ${scoreInput.subject_id}`);
      continue;
    }

    const recordData = {
      score: String(scoreInput.score),
      max_marks: scoreInput.max_marks,
      recorded_by_teacher_id: scoreInput.recorded_by_teacher_id,
      date_recorded: new Date().toISOString().split('T')[0],
    };
    
    if (existingRecord) {
      const { error: updateError } = await supabaseAdmin
        .from('student_scores')
        .update(recordData)
        .eq('id', existingRecord.id);

      if (updateError) {
        errors.push(`Update failed for subject ${scoreInput.subject_id}`);
        console.error("Update error:", updateError);
      } else {
        savedCount++;
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('student_scores')
        .insert({
          ...recordData,
          student_id: scoreInput.student_id,
          exam_id: scoreInput.exam_id,
          subject_id: scoreInput.subject_id,
          class_id: scoreInput.class_id,
          school_id: scoreInput.school_id,
        });
      
      if (insertError) {
        errors.push(`Insert failed for subject ${scoreInput.subject_id}`);
        console.error("Insert error:", insertError);
      } else {
        savedCount++;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, message: `Successfully saved ${savedCount} scores, but failed for ${errors.length}. Errors: ${errors.join(', ')}`, savedCount };
  }
  
  revalidatePath('/teacher/student-scores');
  revalidatePath('/admin/student-scores'); 
  revalidatePath('/student/my-scores'); 
  
  if (savedCount > 0) {
    const firstScore = scoresToSave[0];
     try {
        const { data: studentEmailData } = await supabaseAdmin.from('students').select('email').eq('id', firstScore.student_id).single();
        const { data: examDetails } = await supabaseAdmin.from('exams').select('name').eq('id', firstScore.exam_id).single();
        
        if (studentEmailData?.email && examDetails?.name) {
          const emailSubject = `Scores Updated for Exam: ${examDetails.name}`;
          const emailBody = `
            <h1>Scores Updated</h1>
            <p>Your scores for the exam "<strong>${examDetails.name}</strong>" have been updated by your teacher.</p>
            <p>Please log in to CampusHub to view your detailed results once they are published.</p>
          `;
          
          try {
            console.log(`[saveStudentScoresAction] Attempting to send score notification via API to: ${studentEmailData.email}`);
            const emailApiUrl = new URL('/api/send-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002').toString();
            const apiResponse = await fetch(emailApiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: studentEmailData.email, subject: emailSubject, html: emailBody }),
            });
            const result = await apiResponse.json();
             if (!apiResponse.ok || !result.success) {
              console.error(`[saveStudentScoresAction] Failed to send email via API: ${result.message || apiResponse.statusText}`);
            } else {
              console.log(`[saveStudentScoresAction] Email successfully dispatched via API: ${result.message}`);
            }
          } catch (apiError: any) {
            console.error(`[saveStudentScoresAction] Error calling email API: ${apiError.message}`);
          }
        }
      } catch (emailSetupError: any) {
        console.error(`Failed to prepare data for score notification to student ${firstScore.student_id}:`, emailSetupError.message);
      }
  }
  
  return { ok: true, message: `Successfully saved/updated ${savedCount} student scores.`, savedCount };
}
