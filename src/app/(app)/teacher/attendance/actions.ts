
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AttendanceStatus, AttendanceRecord } from '@/types';

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
