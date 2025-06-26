
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Exam, Subject, StudentScore, ExamWithStudentScore } from '@/types';

const PASS_PERCENTAGE = 40;

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
  const now = new Date().toISOString();

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

    // Fetch all exams for the school where the results have been published
    const { data: examsData, error: examsError } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', studentSchoolId)
      .lte('publish_date', now) // Only fetch exams where publish_date is in the past
      .order('date', { ascending: false });

    if (examsError) {
      return { ok: false, message: `Failed to fetch exams: ${examsError.message}`, studentProfileId, studentSchoolId };
    }
    if (!examsData || examsData.length === 0) {
        return { ok: true, examsWithScores: [], studentProfileId, studentSchoolId };
    }

    const examIds = examsData.map(e => e.id);

    // Fetch all scores for this student for the published exams
    const { data: scoresData, error: scoresError } = await supabase
      .from('student_scores')
      .select('exam_id, subject_id, score, max_marks')
      .eq('student_id', studentProfileId)
      .in('exam_id', examIds);
    
    if (scoresError) {
      console.warn("Failed to fetch student scores:", scoresError.message);
    }
    
    // Fetch all subjects for the school to enrich exam data
    const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', studentSchoolId);
    
    if (subjectsError) {
        console.warn("Failed to fetch subjects:", subjectsError.message);
    }

    const enrichedExams: ExamWithStudentScore[] = examsData.map(exam => {
      const scoresForThisExam = (scoresData || []).filter(score => score.exam_id === exam.id);
      
      const studentScores = scoresForThisExam.map(score => ({
          subject_id: score.subject_id,
          subjectName: subjectsData?.find(sub => sub.id === score.subject_id)?.name || 'Unknown Subject',
          score: score.score,
          max_marks: score.max_marks ?? exam.max_marks ?? 100,
      }));

      let overallResult: ExamWithStudentScore['overallResult'] | undefined = undefined;
      if (studentScores.length > 0) {
        const totalMarks = studentScores.reduce((acc, s) => acc + Number(s.score || 0), 0);
        const maxMarks = studentScores.reduce((acc, s) => acc + (s.max_marks ?? 100), 0);
        const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
        const status = percentage >= PASS_PERCENTAGE ? 'Pass' : 'Fail';
        
        overallResult = { totalMarks, maxMarks, percentage, status };
      }

      return {
        ...exam,
        studentScores: studentScores.length > 0 ? studentScores : null,
        overallResult,
      };
    }).filter(exam => exam.studentScores !== null); // Only return exams where the student has at least one score

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
