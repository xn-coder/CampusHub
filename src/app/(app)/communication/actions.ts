
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole, ClassData } from '@/types'; // Use AnnouncementDB for DB schema

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
  school_id?: string | null; // Optional for superadmin
  user_role: UserRole;
  user_id?: string; 
  student_class_id?: string; 
  teacher_class_ids?: string[];
}

export async function getAnnouncementsAction(params: GetAnnouncementsParams): Promise<{ ok: boolean; message?: string; announcements?: AnnouncementDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, user_role, user_id, student_class_id, teacher_class_ids } = params;

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
      // Superadmin sees all announcements if no specific school_id is passed.
      // If school_id is passed (e.g., future school selector for superadmin), filter by it.
      if (school_id) {
        query = query.eq('school_id', school_id);
      }
      // Otherwise, no school_id filter, gets all.
    } else if (school_id) { // All other roles are school-scoped
      query = query.eq('school_id', school_id);

      if (user_role === 'student' && student_class_id) {
        // Students: own class specific OR school-wide general (no target_class_id)
        query = query.or(`target_class_id.eq.${student_class_id},target_class_id.is.null`);
      } else if (user_role === 'teacher' && user_id) {
        let teacherOrConditions = [];
        // Targeted to any of their classes
        if (teacher_class_ids && teacher_class_ids.length > 0) {
          teacherOrConditions.push(`target_class_id.in.(${teacher_class_ids.join(',')})`);
        }
        // Their own general posts
        teacherOrConditions.push(`and(posted_by_user_id.eq.${user_id},target_class_id.is.null)`);
        // School-wide general from admin/superadmin
        teacherOrConditions.push(`and(target_class_id.is.null,posted_by_role.in.("admin","superadmin"))`);
        
        if(teacherOrConditions.length > 0) {
            query = query.or(teacherOrConditions.join(','));
        } else {
            // If teacher has no classes and makes no general posts, they only see admin/superadmin general
            query = query.and(`target_class_id.is.null,posted_by_role.in.("admin","superadmin")`)
        }
      } else if (user_role === 'admin') {
        // Admins: all for their school_id (already applied)
        // PLUS global superadmin posts (school_id IS NULL AND posted_by_role === 'superadmin')
        // This requires a more complex query structure if we want to OR this condition.
        // For now, the school_id filter above will limit them. To see global superadmin posts,
        // the client would need to make a separate call or this logic would need to be broader.
        // For simplicity here, admin sees their school's posts.
        // A superadmin post with school_id=null won't be caught by school_id filter.
        // If an admin should see global superadmin posts, we could add:
        // .or(`school_id.eq.${school_id},and(school_id.is.null,posted_by_role.eq.superadmin)`)
        // but let's keep it simpler for now.
      }
    } else if (user_role !== 'superadmin' && !school_id) {
      // Non-superadmin without school_id should not see any announcements
      return {ok: true, announcements: [] };
    }


    const { data, error } = await query;

    if (error) {
      console.error("Error fetching announcements:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, announcements: (data || []) as AnnouncementDB[] };
  } catch (e: any) {
    console.error("Unexpected error fetching announcements:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}

