
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { ClassData, Student, AttendanceRecord } from '@/types';

async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolId: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: school, error } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export async function getAdminAttendancePageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  classes?: ClassData[];
  students?: Student[]; // All students for the school, filtering done client-side or in specific record fetch
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [classesRes, studentsRes] = await Promise.all([
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
    ]);

    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);

    return {
      ok: true,
      schoolId,
      classes: classesRes.data || [],
      students: studentsRes.data || [],
    };
  } catch (error: any) {
    console.error("Error in getAdminAttendancePageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

export async function fetchAttendanceRecordsAction(
  schoolId: string,
  classId: string,
  date: string
): Promise<{ ok: boolean; records?: AttendanceRecord[]; message?: string }> {
  if (!schoolId || !classId || !date) {
    return { ok: false, message: "School ID, Class ID, and Date are required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('date', date);

    if (error) {
      console.error("Error fetching attendance records:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, records: data || [] };
  } catch (error: any) {
    console.error("Unexpected error fetching attendance records:", error);
    return { ok: false, message: `Unexpected error: ${error.message}` };
  }
}
    