
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { CalendarEventDB, UserRole } from '@/types';

interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  is_all_day: boolean;
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  description?: string | null;
  school_id: string;
  posted_by_user_id: string;
}

export async function addCalendarEventAction(
  input: CalendarEventInput
): Promise<{ ok: boolean; message: string; event?: CalendarEventDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title: input.title,
        date: input.date,
        is_all_day: input.is_all_day,
        start_time: input.is_all_day ? null : input.start_time,
        end_time: input.is_all_day ? null : input.end_time,
        description: input.description,
        school_id: input.school_id,
        posted_by_user_id: input.posted_by_user_id,
      })
      .select('*, posted_by_user:posted_by_user_id (name, role)') // Eager load user details
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
  input: Partial<CalendarEventInput> & { school_id: string; posted_by_user_id: string }
): Promise<{ ok: boolean; message: string; event?: CalendarEventDB }> {
  const supabase = createSupabaseServerClient();
  
  const updateData: Partial<Omit<CalendarEventDB, 'id' | 'created_at' | 'updated_at' | 'posted_by_user'>> = { 
    title: input.title,
    date: input.date,
    is_all_day: input.is_all_day,
    description: input.description,
    posted_by_user_id: input.posted_by_user_id, // Ensure this is part of update if it can change
    school_id: input.school_id // Though usually school_id shouldn't change for an existing event
  };

  if (input.is_all_day) {
    updateData.start_time = null;
    updateData.end_time = null;
  } else {
    updateData.start_time = input.start_time;
    updateData.end_time = input.end_time;
  }


  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', input.school_id) 
      .select('*, posted_by_user:posted_by_user_id (name, role)') // Eager load user details
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
      .eq('school_id', school_id); 

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

export async function getCalendarEventsAction(
  school_id: string,
  requesting_user_id: string, 
  requesting_user_role: UserRole 
): Promise<{ ok: boolean; message?: string; events?: CalendarEventDB[] }> {
  const supabase = createSupabaseServerClient();
  try {
    let query = supabase
      .from('calendar_events')
      .select(`
        id, 
        title, 
        description, 
        date, 
        start_time, 
        end_time, 
        is_all_day, 
        school_id,
        posted_by_user_id,
        created_at,
        updated_at,
        posted_by_user:posted_by_user_id (name, role)
      `)
      .eq('school_id', school_id)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true });
      
    const { data, error } = await query;

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
