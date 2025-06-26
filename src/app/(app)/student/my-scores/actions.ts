
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

    const { data: examsData, error: examsError } = await supabase
      .from('exams')
      .select('*')
      .eq('school_id', studentSchoolId)
      .order('date', { ascending: false });

    if (examsError) {
      return { ok: false, message: `Failed to fetch exams: ${examsError.message}`, studentProfileId, studentSchoolId };
    }
    if (!examsData || examsData.length === 0) {
        return { ok: true, examsWithScores: [], studentProfileId, studentSchoolId };
    }

    const examIds = examsData.map(e => e.id);

    const { data: scoresData, error: scoresError } = await supabase
      .from('student_scores')
      .select('exam_id, subject_id, score, max_marks')
      .eq('student_id', studentProfileId)
      .in('exam_id', examIds);
    
    if (scoresError) {
      console.warn("Failed to fetch student scores:", scoresError.message);
    }
    
    const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', studentSchoolId);
    
    if (subjectsError) {
        console.warn("Failed to fetch subjects:", subjectsError.message);
    }

    const examGroups: Record<string, Exam[]> = {};

    examsData.forEach(exam => {
        const groupName = exam.name.split(' - ')[0];
        const groupKey = `${groupName}_${exam.date}_${exam.class_id || 'global'}`;
        if (!examGroups[groupKey]) {
            examGroups[groupKey] = [];
        }
        examGroups[groupKey].push(exam);
    });

    const reportCards: ExamWithStudentScore[] = Object.values(examGroups).map(group => {
        const representativeExam = group[0];
        const groupName = representativeExam.name.split(' - ')[0];

        const studentScoresForGroup = group.map(examInGroup => {
            const score = scoresData?.find(s => s.exam_id === examInGroup.id);
            if (!score) return null;

            return {
                subject_id: examInGroup.subject_id,
                subjectName: subjectsData?.find(sub => sub.id === examInGroup.subject_id)?.name || 'Unknown Subject',
                score: score.score,
                max_marks: score.max_marks ?? examInGroup.max_marks ?? 100,
            };
        }).filter(s => s !== null) as Exclude<ExamWithStudentScore['studentScores'], null | undefined>;

        if (studentScoresForGroup.length === 0) {
            return null;
        }

        const totalMarks = studentScoresForGroup.reduce((acc, s) => acc + Number(s!.score || 0), 0);
        const maxMarksTotal = studentScoresForGroup.reduce((acc, s) => acc + (s!.max_marks ?? 100), 0);
        const percentage = maxMarksTotal > 0 ? (totalMarks / maxMarksTotal) * 100 : 0;
        const status: 'Pass' | 'Fail' = percentage >= PASS_PERCENTAGE ? 'Pass' : 'Fail';

        const reportCard: ExamWithStudentScore = {
            ...representativeExam,
            id: groupName + '_' + representativeExam.date, // Stable ID for the group
            name: groupName,
            studentScores: studentScoresForGroup,
            overallResult: {
                totalMarks,
                maxMarks: maxMarksTotal,
                percentage,
                status,
            },
        };
        return reportCard;
    }).filter(rc => rc !== null) as ExamWithStudentScore[];
    
    reportCards.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ok: true,
      examsWithScores: reportCards,
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
