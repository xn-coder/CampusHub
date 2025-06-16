'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole } from '@/types'; // Use AnnouncementDB for DB schema

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
        date: new Date().toISOString(), // Store as ISO string
        target_class_id: input.target_class_id || null, // Ensure NULL if empty
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
  school_id: string;
  user_role: UserRole;
  user_id?: string; // For teacher/student specific views
  student_class_id?: string; // For student's class
}

export async function getAnnouncementsAction(params: GetAnnouncementsParams): Promise<{ ok: boolean; message?: string; announcements?: AnnouncementDB[] }> {
  const supabase = createSupabaseServerClient();
  const { school_id, user_role, user_id, student_class_id } = params;

  try {
    let query = supabase
      .from('announcements')
      .select(`
        *,
        posted_by:posted_by_user_id ( name, email ),
        target_class:target_class_id ( name, division )
      `)
      .eq('school_id', school_id)
      .order('date', { ascending: false });

    // Role-based filtering
    if (user_role === 'student') {
      // Students see:
      // 1. Announcements targeted to their class_id
      // 2. Announcements with NO target_class_id (general school/admin/superadmin announcements)
      // 3. Announcements posted by 'admin' or 'superadmin' (implicitly general if not targeted)
      query = query.or(`target_class_id.eq.${student_class_id},target_class_id.is.null,posted_by_role.in.("admin","superadmin")`);
    } else if (user_role === 'teacher') {
      // Teachers see announcements posted by admin/superadmin, other teachers, or targeted to classes they teach (more complex to filter here without class list)
      // For simplicity, teachers see all non-student announcements for their school.
      // A more refined query could filter by `target_class_id` if teacher's classes are passed.
       query = query.neq('posted_by_role', 'student');
    }
    // Admins see all for their school (already filtered by school_id)
    // Superadmins might see all across all schools (handled by a different page or logic)

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
