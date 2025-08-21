
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// Action to get a user's favorite courses
export async function getFavoriteCoursesAction(userId: string): Promise<{ ok: boolean; courseIds?: string[]; message?: string }> {
    if (!userId) {
        return { ok: false, message: "User not identified." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('lms_user_favorite_courses')
            .select('course_id')
            .eq('user_id', userId);

        if (error) throw error;
        return { ok: true, courseIds: data.map(item => item.course_id) };
    } catch (e: any) {
        console.error("Error fetching favorite courses:", e);
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}

// Action to add or remove a course from favorites
export async function toggleFavoriteCourseAction(userId: string, courseId: string): Promise<{ ok: boolean; message: string }> {
    if (!userId || !courseId) {
        return { ok: false, message: "User and Course IDs are required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        // Check if the favorite already exists
        const { data: existing, error: checkError } = await supabase
            .from('lms_user_favorite_courses')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .maybeSingle();

        if (checkError) throw new Error(`DB check failed: ${checkError.message}`);

        if (existing) {
            // It exists, so delete it
            const { error: deleteError } = await supabase
                .from('lms_user_favorite_courses')
                .delete()
                .eq('id', existing.id);

            if (deleteError) throw new Error(`Failed to remove favorite: ${deleteError.message}`);
            revalidatePath('/lms/available-courses');
            return { ok: true, message: "Removed from favorites." };
        } else {
            // It doesn't exist, so insert it
            const { error: insertError } = await supabase
                .from('lms_user_favorite_courses')
                .insert({ user_id: userId, course_id: courseId });

            if (insertError) throw new Error(`Failed to add favorite: ${insertError.message}`);
            revalidatePath('/lms/available-courses');
            return { ok: true, message: "Added to favorites." };
        }
    } catch (e: any) {
        console.error("Error toggling favorite course:", e);
        return { ok: false, message: e.message || "An unexpected error occurred." };
    }
}
