
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { ClassData, Exam, Student, Subject, GradebookEntry } from '@/types';

export async function getTeacherGradebookInitialDataAction(teacherUserId: string): Promise<{
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
    console.error("Error in getTeacherGradebookInitialDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}


export async function getGradebookDataAction(
  classId: string,
  examGroupId: string, // The ID of the representative exam for the group
  schoolId: string,
  allExams: Exam[], // Passed from client to avoid re-fetching
  allSubjects: Subject[] // Passed from client to avoid re-fetching
): Promise<{
  ok: boolean;
  message?: string;
  students?: Student[];
  subjects?: Subject[];
  scores?: Record<string, GradebookEntry>;
}> {
  if (!classId || !examGroupId || !schoolId) {
    return { ok: false, message: "Class ID, Exam Group ID, and School ID are required." };
  }
  const supabase = createSupabaseServerClient();

  try {
    const representativeExam = allExams.find(e => e.id === examGroupId);
    if (!representativeExam) {
      return { ok: false, message: "Exam event not found." };
    }
    const examGroupName = representativeExam.name.split(' - ')[0];

    const examsInGroup = allExams.filter(e => 
        e.name.startsWith(examGroupName) && 
        e.date === representativeExam.date &&
        e.class_id === representativeExam.class_id
    );
    const subjectIdsInGroup = examsInGroup.map(e => e.subject_id);
    const subjectsForGradebook = allSubjects.filter(s => subjectIdsInGroup.includes(s.id));
    const examIdsInGroup = examsInGroup.map(e => e.id);

    const { data: students, error: studentsError } = await supabase
        .from('students').select('*').eq('class_id', classId).eq('school_id', schoolId).order('name');
    if (studentsError) throw new Error("Failed to fetch students.");
    
    const studentIds = (students || []).map(s => s.id);
    const scoresMap: Record<string, GradebookEntry> = {};

    if (studentIds.length > 0) {
        const { data: existingScores, error: scoresError } = await supabase
            .from('student_scores')
            .select('*')
            .in('student_id', studentIds)
            .in('exam_id', examIdsInGroup);

        if (scoresError) throw new Error("Failed to fetch existing scores.");

        (existingScores || []).forEach(score => {
            const key = `${score.student_id}-${score.subject_id}`;
            scoresMap[key] = {
                score: score.score,
                max_marks: score.max_marks || examsInGroup.find(e => e.id === score.exam_id)?.max_marks || 100,
                student_id: score.student_id,
                exam_id: score.exam_id,
                subject_id: score.subject_id,
                class_id: classId,
            };
        });
    }

    // Pre-fill the map with empty entries for the UI
    (students || []).forEach(student => {
        subjectsForGradebook.forEach(subject => {
            const key = `${student.id}-${subject.id}`;
            if (!scoresMap[key]) {
                const correspondingExam = examsInGroup.find(e => e.subject_id === subject.id);
                scoresMap[key] = {
                    score: '',
                    max_marks: correspondingExam?.max_marks || 100,
                    student_id: student.id,
                    exam_id: correspondingExam?.id || '',
                    subject_id: subject.id,
                    class_id: classId,
                };
            }
        });
    });

    return {
      ok: true,
      students: students || [],
      subjects: subjectsForGradebook,
      scores: scoresMap
    };
  } catch (error: any) {
    console.error("Error in getGradebookDataAction:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function saveGradebookScoresAction(
    scoresToSave: GradebookEntry[],
    teacherId: string,
    schoolId: string
): Promise<{ ok: boolean; message: string }> {
    if (scoresToSave.length === 0) {
        return { ok: true, message: "No scores to save." };
    }
    const supabaseAdmin = createSupabaseServerClient();
    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    // Process each score individually to avoid ON CONFLICT issues by manually checking.
    for (const score of scoresToSave) {
        try {
            // A score is uniquely identified by the student and the specific exam instance.
            const { data: existingScore, error: checkError } = await supabaseAdmin
                .from('student_scores')
                .select('id')
                .eq('student_id', score.student_id)
                .eq('exam_id', score.exam_id)
                .maybeSingle(); // Use maybeSingle to handle 0 or 1 result without error.

            if (checkError) throw new Error(`DB check failed: ${checkError.message}`);

            const recordToSave = {
                score: String(score.score),
                max_marks: score.max_marks,
                recorded_by_teacher_id: teacherId,
                date_recorded: new Date().toISOString().split('T')[0],
            };

            if (existingScore) {
                // UPDATE existing score
                const { error: updateError } = await supabaseAdmin
                    .from('student_scores')
                    .update(recordToSave)
                    .eq('id', existingScore.id);
                
                if (updateError) throw new Error(`Update failed: ${updateError.message}`);
                successCount++;

            } else {
                // INSERT new score
                const { error: insertError } = await supabaseAdmin
                    .from('student_scores')
                    .insert({
                        ...recordToSave,
                        student_id: score.student_id,
                        exam_id: score.exam_id,
                        subject_id: score.subject_id,
                        class_id: score.class_id,
                        school_id: schoolId,
                    });

                if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
                successCount++;
            }
        } catch (e: any) {
            errorCount++;
            errorMessages.push(`Failed for student ${score.student_id}, subject ${score.subject_id}: ${e.message}`);
            console.error(`Error processing score for student ${score.student_id}:`, e);
        }
    }

    if (successCount > 0) {
        revalidatePath('/teacher/student-scores');
        revalidatePath('/admin/student-scores');
        revalidatePath('/student/my-scores');
    }

    if (errorCount > 0) {
        return { 
            ok: false, 
            message: `Successfully saved ${successCount} scores, but failed for ${errorCount}. Errors: ${errorMessages.join('; ')}`
        };
    }

    return { ok: true, message: `${successCount} score(s) saved successfully.` };
}
