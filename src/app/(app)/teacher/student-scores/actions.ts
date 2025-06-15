
'use server';

import { supabase } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { StudentScore } from '@/types';

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
  if (!scoresToSave || scoresToSave.length === 0) {
    return { ok: true, message: 'No scores provided to save.', savedCount: 0 };
  }

  let savedCount = 0;
  const errors: string[] = [];

  for (const scoreInput of scoresToSave) {
    // Check if a score record already exists for this student, exam, class combination
    const { data: existingScore, error: fetchError } = await supabase
      .from('student_scores')
      .select('id')
      .eq('student_id', scoreInput.student_id)
      .eq('exam_id', scoreInput.exam_id)
      .eq('class_id', scoreInput.class_id)
      .eq('school_id', scoreInput.school_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: no rows, which is fine for new insert
      errors.push(`Error checking existing score for student ${scoreInput.student_id}: ${fetchError.message}`);
      continue;
    }

    const recordData = {
      student_id: scoreInput.student_id,
      exam_id: scoreInput.exam_id,
      subject_id: scoreInput.subject_id,
      class_id: scoreInput.class_id,
      score: String(scoreInput.score), // Ensure score is string for DB if type is TEXT
      max_marks: scoreInput.max_marks,
      recorded_by_teacher_id: scoreInput.recorded_by_teacher_id,
      date_recorded: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      school_id: scoreInput.school_id,
    };

    if (existingScore) { // Update existing score
      const { error: updateError } = await supabase
        .from('student_scores')
        .update(recordData)
        .eq('id', existingScore.id);
      if (updateError) {
        errors.push(`Error updating score for student ${scoreInput.student_id}: ${updateError.message}`);
      } else {
        savedCount++;
      }
    } else { // Insert new score
      const { error: insertError } = await supabase
        .from('student_scores')
        .insert(recordData);
      if (insertError) {
        errors.push(`Error inserting score for student ${scoreInput.student_id}: ${insertError.message}`);
      } else {
        savedCount++;
      }
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
  revalidatePath('/admin/student-scores'); // Admin might view these
  revalidatePath('/student/my-scores'); // Student might view these
  
  return { ok: true, message: `Successfully saved/updated ${savedCount} student scores.`, savedCount };
}
