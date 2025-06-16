
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole, ClassData } from '@/types';
import { sendEmail, getStudentEmailsByClassId, getAllUserEmailsInSchool, getTeacherEmailByTeacherProfileId } from '@/services/emailService';

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
      .select('*, target_class:target_class_id(name, division, teacher_id)') // Eager load target_class for notification
      .single();

    if (error) {
      console.error("Error posting announcement:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    
    revalidatePath('/communication');

    // Send email notifications (mock)
    if (data) {
      const announcement = data as AnnouncementDB & { target_class?: { name: string, division: string, teacher_id?: string | null } };
      const subject = `New Announcement: ${announcement.title}`;
      const emailBody = `
        <h1>New Announcement: ${announcement.title}</h1>
        <p><strong>Posted by:</strong> ${announcement.author_name} (${announcement.posted_by_role})</p>
        <p><strong>Date:</strong> ${new Date(announcement.date).toLocaleString()}</p>
        ${announcement.target_class_id && announcement.target_class ? `<p><strong>For Class:</strong> ${announcement.target_class.name} - ${announcement.target_class.division}</p>` : '<p>This is a general announcement for the school.</p>'}
        <hr>
        <div>${announcement.content.replace(/\n/g, '<br>')}</div>
        <br>
        <p>Please check the communication portal for more details.</p>
      `;
      
      let recipientEmails: string[] = [];
      if (announcement.target_class_id && announcement.school_id) {
        recipientEmails = await getStudentEmailsByClassId(announcement.target_class_id, announcement.school_id);
        if (announcement.target_class?.teacher_id) {
            const teacherEmail = await getTeacherEmailByTeacherProfileId(announcement.target_class.teacher_id);
            if (teacherEmail) recipientEmails.push(teacherEmail);
        }
      } else if (announcement.school_id) {
        recipientEmails = await getAllUserEmailsInSchool(announcement.school_id, ['student', 'teacher', 'admin']);
      }

      if (recipientEmails.length > 0) {
        await sendEmail({
          to: recipientEmails,
          subject: subject,
          html: emailBody,
        });
      }
    }

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
    