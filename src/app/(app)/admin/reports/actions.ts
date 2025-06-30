
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
    const [studentsRes, classesRes, teachersRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
    ]);

    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (teachersRes.error) throw new Error(`Fetching teachers failed: ${teachersRes.error.message}`);

    // Generate mock activity data for students
    const studentsWithMockActivity = (studentsRes.data || []).map(s => ({
      ...s,
      lastLogin: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
      assignmentsSubmitted: Math.floor(Math.random() * 20),
      attendancePercentage: Math.floor(Math.random() * 51) + 50,
    }));
    
    // Generate mock activity data for teachers
    const teachersWithMockActivity = (teachersRes.data || []).map(t => ({
      ...t,
      lastLogin: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
      assignmentsPosted: Math.floor(Math.random() * 15),
      classesTaught: (classesRes.data || []).filter(c => c.teacher_id === t.id).length,
    }));


    return {
      ok: true,
      students: studentsWithMockActivity as Student[],
      teachers: teachersWithMockActivity as Teacher[],
      classes: classesRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in getAdminReportsDataAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}
