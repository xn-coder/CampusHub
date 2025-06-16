
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
  student_class_id?: string; 
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
      // Superadmin sees all school-specific announcements if a school_id context is provided,
      // OR all global announcements (school_id IS NULL).
      // If no school_id, they see *all* announcements (school-specific and global). This might be too broad.
      // Let's refine: if school_id is provided, filter by it. If not, show global + all school-specific.
      // For simplicity now, if no school_id, they see all. If school_id, only that school's.
      if (school_id) {
        query = query.eq('school_id', school_id);
      }
      // No else, superadmin without specific school_id context sees everything.
    } else if (school_id) { // All other roles are strictly school-scoped
      query = query.eq('school_id', school_id);

      if (user_role === 'student' && student_class_id) {
        // Students: own class specific OR school-wide general (no target_class_id)
        query = query.or(`target_class_id.eq.${student_class_id},target_class_id.is.null`);
      } else if (user_role === 'teacher' && user_id) {
        // Teachers:
        // 1. Announcements targeted to any of their classes.
        // 2. General school announcements (target_class_id is null).
        // 3. Their own general announcements (target_class_id is null AND posted_by_user_id is them).
        let orConditions = [`target_class_id.is.null`]; // General school announcements
        if (teacher_class_ids.length > 0) {
          orConditions.push(`target_class_id.in.(${teacher_class_ids.join(',')})`);
        }
        // Their own general posts are already covered by `target_class_id.is.null` if we don't further filter by poster role.
        // For simplicity, let's assume teachers see all general school announcements + their class-specific ones.
        query = query.or(orConditions.join(','));

      } else if (user_role === 'admin') {
        // Admins see all for their school (already filtered by school_id).
        // No additional role-based filtering needed beyond school_id.
      }
    } else { 
      // Non-superadmin without school_id should not see any announcements.
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
