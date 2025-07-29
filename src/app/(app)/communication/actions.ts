

'use server';

console.log('[LOG] Loading src/app/(app)/communication/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole, ClassData, Exam } from '@/types';
import { getStudentEmailsByClassId, getAllUserEmailsInSchool, getTeacherEmailByTeacherProfileId, sendEmail, getAllAdminEmails } from '@/services/emailService';

interface PostAnnouncementInput {
  title: string;
  content: string;
  author_name: string;
  posted_by_user_id: string;
  posted_by_role: UserRole;
  target_audience?: 'students' | 'teachers' | 'all';
  target_class_id?: string;
  school_id?: string | null;
  linked_exam_id?: string;
}

export async function postAnnouncementAction(
  input: PostAnnouncementInput
): Promise<{ ok: boolean; message: string; announcement?: AnnouncementDB }> {
  const supabase = createSupabaseServerClient();
  let finalContent = input.content;
  let emailHtmlBody = `<p>${input.content.replace(/\n/g, '<br>')}</p>`;

  try {
    if (input.linked_exam_id) {
      const { data: examDetails, error: examError } = await supabase
        .from('exams')
        .select('name, date, start_time, end_time, max_marks')
        .eq('id', input.linked_exam_id)
        .single();
      
      if (examError) {
        console.warn(`Could not fetch linked exam details: ${examError.message}`);
      } else if (examDetails) {
        const examInfoText = `\n\n--- Associated Exam Details ---\nExam: ${examDetails.name}\nDate: ${new Date(examDetails.date).toLocaleDateString()}\nTime: ${examDetails.start_time || 'N/A'}`;
        finalContent += examInfoText;
        
        const examInfoHtml = `
          <hr>
          <h2>Associated Exam Details</h2>
          <ul>
            <li><strong>Exam:</strong> ${examDetails.name}</li>
            <li><strong>Date:</strong> ${new Date(examDetails.date).toLocaleDateString()}</li>
            ${examDetails.start_time ? `<li><strong>Time:</strong> ${examDetails.start_time}${examDetails.end_time ? ` - ${examDetails.end_time}` : ''}</li>` : ''}
            ${examDetails.max_marks ? `<li><strong>Max Marks:</strong> ${examDetails.max_marks}</li>` : ''}
          </ul>
        `;
        emailHtmlBody += examInfoHtml;
      }
    }


    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: input.title,
        content: finalContent,
        author_name: input.author_name,
        posted_by_user_id: input.posted_by_user_id,
        posted_by_role: input.posted_by_role,
        target_audience: input.target_audience || 'all',
        date: new Date().toISOString(),
        target_class_id: input.target_class_id || null,
        school_id: input.school_id || null,
        linked_exam_id: input.linked_exam_id || null,
      })
      .select('*, target_class:target_class_id(name, division, teacher_id)')
      .single();

    if (error) {
      console.error("Error posting announcement:", error);
      return { ok: false, message: `Database error: ${error.message}` };
    }
    
    revalidatePath('/communication');

    if (data) {
       const announcement = data as AnnouncementDB & { 
        target_class?: { name: string, division: string, teacher_id?: string | null },
      };
      
      let subject = `New Announcement: ${announcement.title}`;
       if (input.linked_exam_id) {
          subject = `Exam Notification: ${announcement.title}`;
      }
      
      const fullEmailBody = `
        <h1>${subject}</h1>
        <p><strong>Posted by:</strong> ${announcement.author_name} (${announcement.posted_by_role})</p>
        <p><strong>Date:</strong> ${new Date(announcement.date).toLocaleString()}</p>
        ${(announcement.target_class_id && announcement.target_class ? `<p><strong>For Class:</strong> ${announcement.target_class.name} - ${announcement.target_class.division}</p>` : (announcement.school_id ? '<p>This is a general announcement for the school.</p>' : '<p>This is a global announcement for all school administrators.</p>'))}
        ${emailHtmlBody}
        <p>Please check the communication portal for more details.</p>
      `;
      
      let recipientEmails: string[] = [];
      if (input.posted_by_role === 'superadmin') {
          // Global announcement for all admins
          recipientEmails = await getAllAdminEmails();
      } else if (input.posted_by_role === 'admin' && input.school_id) {
          if (input.target_class_id) {
            const studentEmails = await getStudentEmailsByClassId(input.target_class_id, input.school_id);
            recipientEmails.push(...studentEmails);
            if (announcement.target_class?.teacher_id) {
              const teacherEmail = await getTeacherEmailByTeacherProfileId(announcement.target_class.teacher_id);
              if (teacherEmail) recipientEmails.push(teacherEmail);
            }
          } else {
            const rolesToEmail: UserRole[] = [];
            if(input.target_audience === 'students') rolesToEmail.push('student');
            if(input.target_audience === 'teachers') rolesToEmail.push('teacher');
            if(input.target_audience === 'all') rolesToEmail.push('student', 'teacher', 'admin'); // Admin should also get general school announcements
            recipientEmails = await getAllUserEmailsInSchool(input.school_id, rolesToEmail);
          }
      } else if (input.posted_by_role === 'teacher' && input.school_id && input.target_class_id) {
          recipientEmails = await getStudentEmailsByClassId(input.target_class_id, input.school_id);
      }
      
      recipientEmails = [...new Set(recipientEmails)];

      if (recipientEmails.length > 0) {
        try {
          console.log(`[postAnnouncementAction] Attempting to send announcement notification via email service to: ${recipientEmails.join(', ')}`);
          const result = await sendEmail({ to: recipientEmails, subject: subject, html: fullEmailBody });
          if (!result.ok) {
            console.error(`[postAnnouncementAction] Failed to send email via service: ${result.message}`);
          } else {
            console.log(`[postAnnouncementAction] Email successfully dispatched via service: ${result.message}`);
          }
        } catch (apiError: any) {
          console.error(`[postAnnouncementAction] Error calling email service: ${apiError.message}`);
        }
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
      .select(`*, posted_by:posted_by_user_id(name, email), target_class:target_class_id(name, division)`)
      .order('date', { ascending: false });

    if (user_role === 'superadmin') {
      // Superadmin sees ONLY global announcements (school_id is null)
      query = query.is('school_id', null);
    } else if (user_role === 'admin') {
      // Admin sees announcements for their school AND global announcements
      if (school_id) {
        query = query.or(`school_id.eq.${school_id},school_id.is.null`);
      } else {
        return { ok: false, message: "School context missing for admin." };
      }
    } else if (user_role === 'student' && school_id) {
      // Students see their class-specific announcements, OR school-wide ones for students/all.
      query = query
        .eq('school_id', school_id)
        .or(`target_class_id.eq.${student_class_id},and(target_class_id.is.null,target_audience.in.("all","students"))`);

    } else if (user_role === 'teacher' && school_id) {
      // Teachers see announcements for their classes, OR school-wide ones for teachers/all.
      let classFilter = `target_class_id.is.null,and(target_audience.in.("all","teachers"))`;
      if (teacher_class_ids.length > 0) {
        classFilter = `target_class_id.in.(${teacher_class_ids.join(',')}),${classFilter}`;
      }
       query = query
        .eq('school_id', school_id)
        .or(classFilter);

    } else {
      // User has no school context and is not superadmin, so they see nothing.
      return { ok: true, announcements: [] };
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

export async function getExamDetailsForLinkingAction(examId: string): Promise<{
    ok: boolean;
    exam?: Exam | null;
    message?: string;
}> {
    if (!examId) return { ok: false, message: "Exam ID is required." };
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('exams')
        .select('id, name, class_id')
        .eq('id', examId)
        .single();
    
    if (error) {
        console.error("Error fetching exam details for linking:", error);
        return { ok: false, message: `DB error: ${error.message}` };
    }
    return { ok: true, exam: data as Exam };
}
