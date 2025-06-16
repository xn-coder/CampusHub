
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole, ClassData } from '@/types';

interface PostAnnouncementInput {
  title: string;
  content: string;
  author_name: string;
  posted_by_user_id: string;
  posted_by_role: UserRole;
  target_class_id?: string;
  school_id: string;
}

export async function postAnnouncementAction(
  input: PostAnnouncementInput
): Promise<{ ok: boolean; message: string; announcement?: AnnouncementDB }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        ...input,
        date: new Date().toISOString(), 
        target_class_id: input.target_class_id || null, 
      })
      .select()
      .single();

    if (error) {
      console.error("Error posting announcement:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    revalidatePath('/communication');
    return { ok: true, message: 'Announcement posted successfully.', announcement: data as AnnouncementDB };
  } catch (e: any) {
    console.error("Unexpected error posting announcement:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

interface GetAnnouncementsParams {
  school_id?: string | null; 
  user_role: UserRole;
  user_id?: string; 
  student_class_id?: string | null; 
  teacher_class_ids?: string[];
}

export async function getAnnouncementsAction(params: GetAnnouncementsParams): Promise<{ ok: boolean; message?: string; announcements?: AnnouncementDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, user_role, user_id, student_class_id, teacher_class_ids = [] } = params;

  try {
    let query = supabase
      .from('announcements')
      .select(`
        *,
        posted_by:posted_by_user_id ( name, email ),
        target_class:target_class_id ( name, division )
      `)
      .order('date', { ascending: false });

    if (user_role === 'superadmin') {
      if (school_id) {
        query = query.eq('school_id', school_id);
      }
    } else if (school_id) { 
      query = query.eq('school_id', school_id);

      if (user_role === 'student' && student_class_id) {
        query = query.or(`target_class_id.eq.${student_class_id},target_class_id.is.null`);
      } else if (user_role === 'teacher' && user_id) {
        let orConditions = [`target_class_id.is.null`]; 
        if (teacher_class_ids.length > 0) {
          orConditions.push(`target_class_id.in.(${teacher_class_ids.join(',')})`);
        }
        query = query.or(orConditions.join(','));
      }
    } else { 
      return {ok: true, announcements: [] };
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching announcements:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, announcements: (data || []) as AnnouncementDB[] };
  } catch (e: any)
     {
    console.error("Unexpected error fetching announcements:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
    