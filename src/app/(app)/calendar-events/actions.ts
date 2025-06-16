
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { CalendarEventDB } from '@/types';

interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  is_all_day: boolean;
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  description?: string | null;
  school_id: string;
  // posted_by_user_id: string; // If tracking creator
}

export async function addCalendarEventAction(
  input: CalendarEventInput
): Promise<{ ok: boolean; message: string; event?: CalendarEventDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        ...input,
        start_time: input.is_all_day ? null : input.start_time,
        end_time: input.is_all_day ? null : input.end_time,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding calendar event:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/calendar-events');
    return { ok: true, message: 'Event added successfully.', event: data as CalendarEventDB };
  } catch (e: any) {
    console.error("Unexpected error adding event:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function updateCalendarEventAction(
  id: string,
  input: Partial<CalendarEventInput> & { school_id: string } // Ensure school_id is present for scoping
): Promise<{ ok: boolean; message: string; event?: CalendarEventDB }> {
  const supabase = createSupabaseServerClient();
  const updateData = { ...input };
  if (input.is_all_day) {
    updateData.start_time = null;
    updateData.end_time = null;
  }

  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', input.school_id) // Scope update to school
      .select()
      .single();

    if (error) {
      console.error("Error updating calendar event:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/calendar-events');
    return { ok: true, message: 'Event updated successfully.', event: data as CalendarEventDB };
  } catch (e: any) {
    console.error("Unexpected error updating event:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function deleteCalendarEventAction(id: string, school_id: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id); // Scope delete

    if (error) {
      console.error("Error deleting calendar event:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/calendar-events');
    return { ok: true, message: 'Event deleted successfully.' };
  } catch (e: any) {
    console.error("Unexpected error deleting event:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

export async function getCalendarEventsAction(school_id: string): Promise<{ ok: boolean; message?: string; events?: CalendarEventDB[] }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('school_id', school_id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });

    if (error) {
      console.error("Error fetching calendar events:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, events: (data || []) as CalendarEventDB[] };
  } catch (e: any) {
    console.error("Unexpected error fetching events:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
