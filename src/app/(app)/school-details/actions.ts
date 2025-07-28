
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

export async function updateSchoolDetailsAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const address = formData.get('address') as string | null;
    const contact_email = formData.get('contact_email') as string | null;
    const contact_phone = formData.get('contact_phone') as string | null;
    const logoFile = formData.get('logoFile') as File | null;

    if (!id) return { ok: false, message: "School ID is missing." };

    try {
        let updateData: Partial<Omit<SchoolDetails, 'id'>> = { name, address, contact_email, contact_phone };

        if (logoFile && logoFile.size > 0) {
            const { data: schoolData, error: fetchError } = await supabase.from('schools').select('logo_url').eq('id', id).single();
            if (fetchError) throw new Error("Could not fetch current school data to update logo.");

            const oldLogoUrl = schoolData?.logo_url;
            const sanitizedFileName = logoFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
            const filePath = `public/school-logos/${id}/${uuidv4()}-${sanitizedFileName}`;

            const { error: uploadError } = await supabase.storage.from('campushub').upload(filePath, logoFile, { upsert: true });
            if (uploadError) throw new Error(`Logo upload failed: ${uploadError.message}`);

            const { data: publicUrlData } = supabase.storage.from('campushub').getPublicUrl(filePath);
            updateData.logo_url = publicUrlData.publicUrl;

            if (oldLogoUrl && oldLogoUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
                const oldFilePath = new URL(oldLogoUrl).pathname.replace(`/storage/v1/object/public/campushub/`, '');
                const { error: deleteError } = await supabase.storage.from('campushub').remove([oldFilePath]);
                if (deleteError) {
                    console.warn(`Failed to delete old school logo: ${deleteError.message}`);
                }
            }
        }

        const { error } = await supabase.from('schools').update(updateData).eq('id', id);
        if (error) throw error;

        revalidatePath('/school-details');
        return { ok: true, message: 'School details updated successfully.' };

    } catch(e: any) {
        console.error("Error updating school details:", e);
        return { ok: false, message: `Database error: ${e.message}` };
    }
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
