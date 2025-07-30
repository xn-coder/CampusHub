
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types';

export async function getTeacherStudentsAndClassesAction(teacherId: string, schoolId: string): Promise<{
  ok: boolean;
  students?: Student[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!teacherId || !schoolId) {
    return { ok: false, message: "Teacher ID and School ID are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: teacherClassesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name, division')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId);

    if (classesError) throw new Error(`Fetching teacher's classes failed: ${classesError.message}`);
    
    const assignedClasses = teacherClassesData || [];
    if (assignedClasses.length === 0) {
      return { ok: true, students: [], classes: [] };
    }
    const assignedClassIds = assignedClasses.map(c => c.id);

    const { data: studentsInClasses, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .in('class_id', assignedClassIds)
      .eq('school_id', schoolId)
      .order('name');
    
    if (studentsError) throw new Error(`Fetching students for classes failed: ${studentsError.message}`);

    if (!studentsInClasses || studentsInClasses.length === 0) {
        return { ok: true, students: [], classes: assignedClasses };
    }
    
    const studentIds = studentsInClasses.map(s => s.id);
    const userIds = studentsInClasses.map(s => s.user_id).filter(Boolean);
    
    // Fetch all required activity data in parallel
    const [submissionsRes, attendanceRes, usersRes] = await Promise.all([
        supabase.from('lms_assignment_submissions').select('student_id').in('student_id', studentIds),
        supabase.from('attendance_records').select('student_id, status').in('student_id', studentIds),
        supabase.from('users').select('id, last_sign_in_at').in('id', userIds)
    ]);
    
    if (submissionsRes.error) console.warn("Could not fetch assignment submissions for report:", submissionsRes.error.message);
    if (attendanceRes.error) console.warn("Could not fetch attendance records for report:", attendanceRes.error.message);
    if (usersRes.error) console.warn("Could not fetch user login data for report:", usersRes.error.message);

    // Process assignment submissions count
    const submissionsByStudent = (submissionsRes.data || []).reduce((acc, sub) => {
        acc[sub.student_id] = (acc[sub.student_id] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Process attendance percentage
    const attendanceByStudent = (attendanceRes.data || []).reduce((acc, rec) => {
        if (!acc[rec.student_id]) {
            acc[rec.student_id] = { present: 0, total: 0 };
        }
        if (rec.status === 'Present' || rec.status === 'Late' || rec.status === 'Excused') {
            acc[rec.student_id].present++;
        }
        acc[rec.student_id].total++;
        return acc;
    }, {} as Record<string, { present: number, total: number }>);

    const studentsWithActivity = (studentsInClasses || []).map(s => {
      const attendance = attendanceByStudent[s.id];
      const user = usersRes.data?.find(u => u.id === s.user_id);
      return {
        ...s,
        lastLogin: user?.last_sign_in_at,
        assignmentsSubmitted: submissionsByStudent[s.id] || 0,
        attendancePercentage: attendance && attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 100,
      };
    });


    return {
      ok: true,
      students: studentsWithActivity as Student[],
      classes: assignedClasses,
    };
  } catch (e: any) {
    console.error("Error in getTeacherStudentsAndClassesAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}
