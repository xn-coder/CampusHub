
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/services/emailService';

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

export async function saveStudentScoresAction(scoresToSave: SaveScoreInput[]): Promise<{ ok: boolean; message: string; savedCount: number }> {
  const supabaseAdmin = createSupabaseServerClient();
  if (!scoresToSave || scoresToSave.length === 0) {
    return { ok: true, message: 'No scores provided to save.', savedCount: 0 };
  }

  let savedCount = 0;
  const errors: string[] = [];
  const notifiedStudents: Record<string, { examName: string, subjectName: string, score: string | number, maxMarks?: number | null }> = {};


  for (const scoreInput of scoresToSave) {
    if (typeof scoreInput.score === 'string' && scoreInput.score.trim() === '') {
        continue; 
    }
    
    const { data: existingScore, error: fetchError } = await supabaseAdmin
      .from('student_scores')
      .select('id')
      .eq('student_id', scoreInput.student_id)
      .eq('exam_id', scoreInput.exam_id)
      .eq('class_id', scoreInput.class_id) 
      .eq('school_id', scoreInput.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
      errors.push(`Error checking existing score for student ${scoreInput.student_id}: ${fetchError.message}`);
      continue;
    }

    const recordData = {
      student_id: scoreInput.student_id,
      exam_id: scoreInput.exam_id,
      subject_id: scoreInput.subject_id,
      class_id: scoreInput.class_id,
      score: String(scoreInput.score), 
      max_marks: scoreInput.max_marks,
      recorded_by_teacher_id: scoreInput.recorded_by_teacher_id,
      date_recorded: new Date().toISOString().split('T')[0],
      school_id: scoreInput.school_id,
    };

    let operationError = null;
    if (existingScore) { 
      const { error } = await supabaseAdmin
        .from('student_scores')
        .update(recordData)
        .eq('id', existingScore.id);
      operationError = error;
    } else { 
      const { error } = await supabaseAdmin
        .from('student_scores')
        .insert(recordData);
      operationError = error;
    }

    if (operationError) {
      errors.push(`Error saving score for student ${scoreInput.student_id}: ${operationError.message}`);
    } else {
      savedCount++;
      // Prepare for notification
      const { data: examDetails } = await supabaseAdmin.from('exams').select('name, subject_id').eq('id', scoreInput.exam_id).single();
      const { data: subjectDetails } = examDetails?.subject_id ? await supabaseAdmin.from('subjects').select('name').eq('id', examDetails.subject_id).single() : { data: null };
      
      notifiedStudents[scoreInput.student_id] = {
          examName: examDetails?.name || 'Unknown Exam',
          subjectName: subjectDetails?.name || 'Unknown Subject',
          score: scoreInput.score,
          maxMarks: scoreInput.max_marks
      };
    }
  }

  // Send notifications
  for (const studentId in notifiedStudents) {
    const studentInfo = notifiedStudents[studentId];
    const { data: studentEmailData } = await supabaseAdmin.from('students').select('email').eq('id', studentId).single();
    if (studentEmailData?.email) {
      const emailSubject = `Exam Score Declared: ${studentInfo.examName}`;
      const emailBody = `
        <h1>Exam Score Update</h1>
        <p>Your score for the exam "<strong>${studentInfo.examName}</strong>" (Subject: ${studentInfo.subjectName}) has been declared/updated.</p>
        <p><strong>Score:</strong> ${studentInfo.score}${studentInfo.maxMarks ? ` / ${studentInfo.maxMarks}` : ''}</p>
        <p>Please log in to CampusHub to view your detailed results.</p>
      `;
      await sendEmail({
        to: studentEmailData.email,
        subject: emailSubject,
        html: emailBody,
      });
    }
  }


  if (errors.length > 0) {
    return { 
      ok: false, 
      message: `Saved ${savedCount} scores. Encountered errors: ${errors.join('; ')}`,
      savedCount 
    };
  }

  revalidatePath('/teacher/student-scores');
  revalidatePath('/admin/student-scores'); 
  revalidatePath('/student/my-scores'); 
  
  return { ok: true, message: `Successfully saved/updated ${savedCount} student scores.`, savedCount };
}
