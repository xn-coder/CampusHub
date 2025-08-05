
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { AttendanceRecord } from '@/types';

export async function getStudentAttendanceHistoryAction(
  userId: string
): Promise<{ ok: boolean; message?: string; records?: AttendanceRecord[] }> {
  if (!userId) {
    return { ok: false, message: "User not identified." };
  }
  
  const supabase = createSupabaseServerClient();
  
  try {
    const { data: studentProfile, error: profileError } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
        return { ok: false, message: profileError?.message || "Could not load student profile." };
    }
    
    const { id: studentProfileId, school_id: schoolId } = studentProfile;
    
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
