
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { ClassData, Student, AttendanceRecord, Holiday } from '@/types';

async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  if (!adminUserId) {
    console.error("getAdminSchoolId: Admin User ID is required.");
    return null;
  }
  const supabaseAdmin = createSupabaseServerClient();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('school_id')
    .eq('id', adminUserId)
    .single();
    
  if (error || !user?.school_id) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export async function getAdminAttendancePageDataAction(adminUserId: string): Promise<{
  ok: boolean;
  schoolId?: string | null;
  classes?: ClassData[];
  students?: Student[];
  holidays?: Holiday[];
  message?: string;
}> {
  const schoolId = await getAdminSchoolId(adminUserId);
  if (!schoolId) {
    return { ok: false, message: "Admin not linked to a school or school ID not found." };
  }

  const supabaseAdmin = createSupabaseServerClient();
  try {
    const [classesRes, studentsRes, holidaysRes] = await Promise.all([
      supabaseAdmin.from('classes').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabaseAdmin.from('holidays').select('*').eq('school_id', schoolId)
    ]);

    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    if (studentsRes.error) throw new Error(`Fetching students failed: ${studentsRes.error.message}`);
    
    let holidaysData: Holiday[] = [];
    if (holidaysRes.error) {
        if(holidaysRes.error.message.includes('relation "public.holidays" does not exist')) {
            console.warn("Holidays table does not exist. Attendance report may not exclude holidays.");
            // Gracefully continue without holidays
        } else {
            throw new Error(`Fetching holidays failed: ${holidaysRes.error.message}`);
        }
    } else {
        holidaysData = holidaysRes.data || [];
    }

    return {
      ok: true,
      schoolId,
      classes: classesRes.data || [],
      students: studentsRes.data || [],
      holidays: holidaysData,
    };
  } catch (error: any) {
    console.error("Error in getAdminAttendancePageDataAction:", error);
    return { ok: false, schoolId, message: error.message || "An unexpected error occurred." };
  }
}

export async function fetchAttendanceForReportAction(
  schoolId: string,
  classId: string,
  startDate: Date,
  endDate: Date
): Promise<{ ok: boolean; records?: Pick<AttendanceRecord, 'student_id' | 'status' | 'date'>[]; message?: string }> {
  if (!schoolId || !classId || !startDate || !endDate) {
    return { ok: false, message: "School ID, Class ID, and a valid date range are required." };
  }
  const supabaseAdmin = createSupabaseServerClient();
  try {
    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .select('student_id, status, date')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) {
      console.error("Error fetching attendance records for report:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, records: data || [] };
  } catch (error: any) {
    console.error("Unexpected error fetching attendance report data:", error);
    return { ok: false, message: `Unexpected error: ${error.message}` };
  }
}
