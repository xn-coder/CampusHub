
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { AttendanceRecord } from '@/types';

export async function getStudentAttendanceHistoryAction(
  studentProfileId: string,
  schoolId: string
): Promise<{ ok: boolean; message?: string; records?: AttendanceRecord[] }> {
  if (!studentProfileId || !schoolId) {
    return { ok: false, message: "Student and School IDs are required." };
  }
  
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', studentProfileId)
      .eq('school_id', schoolId)
      .order('date', { ascending: false });

    if (error) {
      console.error("Error fetching student attendance history:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }

    return { ok: true, records: data || [] };
  } catch (e: any) {
    console.error("Unexpected error fetching student attendance history:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
