
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Exam, Subject, StudentScore, ExamWithStudentScore } from '@/types';

export async function getStudentScoresAndExamsAction(userId: string): Promise<{
  ok: boolean;
  examsWithScores?: ExamWithStudentScore[];
  message?: string;
  studentProfileId?: string | null;
  studentSchoolId?: string | null;
}> {
  if (!userId) {
    return { ok: false, message: "User not identified." };
  }

  const supabase = createSupabaseServerClient();

  try {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData || !studentData.id || !studentData.school_id) {
      return {
        ok: false,
        message: studentError?.message || "Student profile or school information not found.",
        studentProfileId: null,
        studentSchoolId: null,
      };
    }

    const { id: studentProfileId, school_id: studentSchoolId } = studentData;

    // Fetch all exams for the school
    const { data: examsData, error: examsError } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', studentSchoolId)
      .order('date', { ascending: false });

    if (examsError) {
      return { ok: false, message: `Failed to fetch exams: ${examsError.message}`, studentProfileId, studentSchoolId };
    }
    if (!examsData) {
        return { ok: true, examsWithScores: [], studentProfileId, studentSchoolId };
    }

    // Fetch all scores for this student in this school
    const { data: scoresData, error: scoresError } = await supabase
      .from('student_scores')
      .select('exam_id, score, max_marks, date_recorded')
      .eq('student_id', studentProfileId)
      .eq('school_id', studentSchoolId);
    
    if (scoresError) {
      console.warn("Failed to fetch student scores, exams will show as 'Result Not Declared':", scoresError.message);
    }

    // Fetch all subjects for the school to enrich exam data
    const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', studentSchoolId);
    
    if (subjectsError) {
        console.warn("Failed to fetch subjects, subject names on exams might be missing:", subjectsError.message);
    }


    const enrichedExams: ExamWithStudentScore[] = examsData.map(exam => {
      const studentScoreForExam = (scoresData || []).find(score => score.exam_id === exam.id);
      const subject = (subjectsData || []).find(sub => sub.id === exam.subject_id);
      return {
        ...exam,
        studentScore: studentScoreForExam ? { 
            score: studentScoreForExam.score, 
            max_marks: studentScoreForExam.max_marks ?? exam.max_marks, // Fallback to exam's max_marks
            date_recorded: studentScoreForExam.date_recorded
        } : null,
        subjectName: subject?.name || 'N/A',
      };
    });

    return {
      ok: true,
      examsWithScores: enrichedExams,
      studentProfileId,
      studentSchoolId,
    };

  } catch (error: any) {
    return {
      ok: false,
      message: `An unexpected error occurred: ${error.message}`,
      studentProfileId: null,
      studentSchoolId: null,
    };
  }
}
