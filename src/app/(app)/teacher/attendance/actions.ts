
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AttendanceStatus, AttendanceRecord, ClassData, Holiday, CalendarEventDB } from '@/types';

interface AttendanceInput {
  student_id: string;
  status: AttendanceStatus;
}

interface SaveAttendancePayload {
  class_id: string;
  date: string; // YYYY-MM-DD
  records: AttendanceInput[];
  teacher_id: string; // Teacher's profile ID (teachers.id)
  school_id: string;
}

export async function getTeacherAttendanceInitialDataAction(teacherUserId: string): Promise<{
  ok: boolean;
  message?: string;
  teacherProfileId?: string;
  schoolId?: string;
  assignedClasses?: ClassData[];
  holidays?: Holiday[];
  allDayEvents?: Pick<CalendarEventDB, 'id' | 'title' | 'date'>[];
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

    const [classesRes, holidaysRes, eventsRes] = await Promise.all([
      supabase.from('classes').select('*').eq('teacher_id', teacherProfileId).eq('school_id', schoolId),
      supabase.from('holidays').select('*').eq('school_id', schoolId),
      supabase.from('calendar_events').select('id, title, date').eq('school_id', schoolId).eq('is_all_day', true)
    ]);
    if (classesRes.error) throw new Error(`Fetching classes failed: ${classesRes.error.message}`);
    
    let holidaysData: Holiday[] = [];
     if (holidaysRes.error) {
        if(holidaysRes.error.message.includes('relation "public.holidays" does not exist')) {
            console.warn("Holidays table does not exist. Attendance cannot check for holidays.");
        } else {
            throw new Error(`Fetching holidays failed: ${holidaysRes.error.message}`);
        }
    } else {
        holidaysData = holidaysRes.data || [];
    }

    if (eventsRes.error) {
      console.warn("Could not fetch calendar events for attendance check:", eventsRes.error.message);
    }
    
    return {
      ok: true,
      teacherProfileId,
      schoolId,
      assignedClasses: (classesRes.data || []) as ClassData[],
      holidays: holidaysData,
      allDayEvents: (eventsRes.data || []) as Pick<CalendarEventDB, 'id' | 'title' | 'date'>[]
    };
  } catch(e: any) {
    console.error("Error in getTeacherAttendanceInitialDataAction:", e);
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}

export async function saveAttendanceAction(
  payload: SaveAttendancePayload
): Promise<{ ok: boolean; message: string; savedCount: number, errorCount: number }> {
  const supabase = createSupabaseServerClient();
  const { class_id, date, records, teacher_id, school_id } = payload;

  if (!records || records.length === 0) {
    return { ok: true, message: 'No attendance records provided to save.', savedCount: 0, errorCount: 0 };
  }

  let savedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const record of records) {
    // Check if a record already exists for this student, class, date, and school
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('student_id', record.student_id)
      .eq('class_id', class_id)
      .eq('date', date)
      .eq('school_id', school_id)
      .maybeSingle();

    if (fetchError) {
      console.error(`Error fetching existing attendance for student ${record.student_id}:`, fetchError);
      errors.push(`Failed to check existing record for student ${record.student_id}.`);
      errorCount++;
      continue;
    }

    const recordData = {
      student_id: record.student_id,
      class_id: class_id,
      date: date,
      status: record.status,
      taken_by_teacher_id: teacher_id,
      school_id: school_id,
    };

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({ status: record.status, taken_by_teacher_id: teacher_id }) // Only update status and who took it
        .eq('id', existingRecord.id);
      
      if (updateError) {
        console.error(`Error updating attendance for student ${record.student_id}:`, updateError);
        errors.push(`Failed to update record for student ${record.student_id}.`);
        errorCount++;
      } else {
        savedCount++;
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(recordData);
      
      if (insertError) {
        console.error(`Error inserting attendance for student ${record.student_id}:`, insertError);
        errors.push(`Failed to insert record for student ${record.student_id}.`);
        errorCount++;
      } else {
        savedCount++;
      }
    }
  }

  if (errorCount > 0) {
    return { 
      ok: false, 
      message: `Successfully saved ${savedCount} records. Failed for ${errorCount} records. Errors: ${errors.join('; ')}`,
      savedCount,
      errorCount
    };
  }

  revalidatePath('/teacher/attendance');
  revalidatePath('/admin/attendance'); // Revalidate admin page too
  
  return { ok: true, message: `Successfully saved ${savedCount} attendance records.`, savedCount, errorCount: 0 };
}
