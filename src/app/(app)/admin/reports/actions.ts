
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData, Teacher } from '@/types'; 

export async function getAdminSchoolIdForReports(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolIdForReports: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();

  if (error || !school) {
    console.error("Error fetching admin's school for reports:", error?.message);
    return null;
  }
  return school.id;
}

export async function getAdminReportsDataAction(schoolId: string): Promise<{
  ok: boolean;
  students?: Student[];
  teachers?: Teacher[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const [studentsRes, classesRes, teachersRes, assignmentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('lms_assignment_submissions').select('student_id', { count: 'exact' }).eq('school_id', schoolId),
      supabase.from('attendance_records').select('student_id, status').eq('school_id', schoolId)
    ]);

    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);
    if (assignmentsRes.error) console.warn("Could not fetch assignment submissions for report:", assignmentsRes.error.message);
    if (attendanceRes.error) console.warn("Could not fetch attendance records for report:", attendanceRes.error.message);

    // Process assignment submissions count
    const submissionsByStudent = (assignmentsRes.data || []).reduce((acc, sub) => {
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


    const studentsWithActivity = (studentsRes.data || []).map(s => {
      const attendance = attendanceByStudent[s.id];
      return {
        ...s,
        assignmentsSubmitted: submissionsByStudent[s.id] || 0,
        attendancePercentage: attendance ? Math.round((attendance.present / attendance.total) * 100) : 100,
      };
    });
    
    // Process teacher activity
    const assignmentsByTeacher = (await supabase.from('assignments').select('teacher_id', { count: 'exact' }).eq('school_id', schoolId)).data || [];
    const assignmentsCountByTeacher = assignmentsByTeacher.reduce((acc, item) => {
        if (item.teacher_id) {
            acc[item.teacher_id] = (acc[item.teacher_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const teachersWithActivity = (teachersRes.data || []).map(t => ({
      ...t,
      assignmentsPosted: assignmentsCountByTeacher[t.id] || 0,
      classesTaught: (classesRes.data || []).filter(c => c.teacher_id === t.id).length,
    }));


    return {
      ok: true,
      students: studentsWithActivity as Student[],
      teachers: teachersWithActivity as Teacher[],
      classes: classesRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in getAdminReportsDataAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}
