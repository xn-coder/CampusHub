
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { Holiday, SchoolDetails } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function getSchoolDetailsAndHolidaysAction(schoolId: string): Promise<{
    ok: boolean; message?: string; details?: SchoolDetails | null; holidays?: Holiday[];
}> {
    if (!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    try {
        const [detailsRes, holidaysRes] = await Promise.all([
            supabase.from('schools').select('*').eq('id', schoolId).single(),
            supabase.from('holidays').select('*').eq('school_id', schoolId).order('date', { ascending: false })
        ]);

        if (detailsRes.error) throw new Error(`Fetching school details failed: ${detailsRes.error.message}`);
        
        let holidaysData: Holiday[] = [];
        if (holidaysRes.error) {
            if (holidaysRes.error.message.includes('relation "public.holidays" does not exist')) {
                console.warn("Holidays table does not exist. Returning empty array.");
                // This is a graceful failure, not an error for the user.
            } else {
                throw new Error(`Fetching holidays failed: ${holidaysRes.error.message}`);
            }
        } else {
            holidaysData = holidaysRes.data;
        }
        
        return { ok: true, details: detailsRes.data, holidays: holidaysData };

    } catch (e: any) {
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}

export async function updateSchoolDetailsAction(details: Partial<Omit<SchoolDetails, 'id' | 'admin_email' | 'admin_name' | 'admin_user_id'>> & { id: string }): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    const { id, ...updateData } = details;
    const { error } = await supabase.from('schools').update(updateData).eq('id', id);

    if (error) {
        console.error("Error updating school details:", error);
        return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/school-details');
    return { ok: true, message: 'School details updated successfully.' };
}

export async function addHolidayAction(holiday: Omit<Holiday, 'id'>): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('holidays').insert({ ...holiday, id: uuidv4() });
    
    if (error) {
        console.error("Error adding holiday:", error);
        return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/school-details');
    revalidatePath('/admin/attendance');
    revalidatePath('/teacher/attendance');
    return { ok: true, message: 'Holiday added successfully.' };
}

export async function deleteHolidayAction(id: string): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from('holidays').delete().eq('id', id);

    if (error) {
        console.error("Error deleting holiday:", error);
        return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/school-details');
    revalidatePath('/admin/attendance');
    revalidatePath('/teacher/attendance');
    return { ok: true, message: 'Holiday deleted successfully.' };
}
