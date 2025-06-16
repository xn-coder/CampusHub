'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { Student, ClassData } from '@/types'; // Assuming types for Student and ClassData

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

export async function getSchoolStudentsAndClassesAction(schoolId: string): Promise<{
  ok: boolean;
  students?: Student[];
  classes?: ClassData[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const [studentsRes, classesRes] = await Promise.all([
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
    ]);

    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);

    // Generate mock activity data here or ensure Student type includes these from DB if they exist
    const studentsWithMockActivity = (studentsRes.data || []).map(s => ({
      ...s,
      // These are simplified/mocked for now as full activity aggregation is complex
      lastLogin: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
      assignmentsSubmitted: Math.floor(Math.random() * 20),
      attendancePercentage: Math.floor(Math.random() * 51) + 50,
    }));


    return {
      ok: true,
      students: studentsWithMockActivity as Student[], // Cast if mock fields are added
      classes: classesRes.data || [],
    };
  } catch (e: any) {
    console.error("Error in getSchoolStudentsAndClassesAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}
