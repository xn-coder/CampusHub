
'use server';

console.log('[LOG] Loading src/app/(app)/communication/actions.ts');

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import type { AnnouncementDB, UserRole, ClassData, Exam } from '@/types';
import { getStudentEmailsByClassId, getAllUserEmailsInSchool, getTeacherEmailByTeacherProfileId } from '@/services/emailService';

interface PostAnnouncementInput {
  title: string;
  content: string;
  author_name: string;
  posted_by_user_id: string;
  posted_by_role: UserRole;
  target_class_id?: string;
  school_id: string;
  linked_exam_id?: string;
}

export async function postAnnouncementAction(
  input: PostAnnouncementInput
): Promise<{ ok: boolean; message: string; announcement?: AnnouncementDB }> {
  const supabase = createSupabaseServerClient();
  let finalContent = input.content;
  let emailHtmlBody = `<p>${input.content.replace(/\n/g, '<br>')}</p>`;

  try {
    // If an exam is linked, fetch its details and append them to the content
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
        content: finalContent, // Use the potentially modified content
        author_name: input.author_name,
        posted_by_user_id: input.posted_by_user_id,
        posted_by_role: input.posted_by_role,
        date: new Date().toISOString(), 
        target_class_id: input.target_class_id || null, 
        school_id: input.school_id,
        // linked_exam_id is NOT saved
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
        ${announcement.target_class_id && announcement.target_class ? `<p><strong>For Class:</strong> ${announcement.target_class.name} - ${announcement.target_class.division}</p>` : '<p>This is a general announcement for the school.</p>'}
        ${emailHtmlBody}
        <p>Please check the communication portal for more details.</p>
      `;
      
      let recipientEmails: string[] = [];
      const targetClassId = input.target_class_id;
      
      if (targetClassId && announcement.school_id) {
        recipientEmails = await getStudentEmailsByClassId(targetClassId, announcement.school_id);
        const { data: classTeacher } = await supabase.from('classes').select('teacher_id').eq('id', targetClassId).single();
        if (classTeacher?.teacher_id) {
            const teacherEmail = await getTeacherEmailByTeacherProfileId(classTeacher.teacher_id);
            if (teacherEmail) recipientEmails.push(teacherEmail);
        }
      } else if (announcement.school_id) {
        recipientEmails = await getAllUserEmailsInSchool(announcement.school_id, ['student', 'teacher', 'admin']);
      }

      if (recipientEmails.length > 0) {
        try {
          console.log(`[postAnnouncementAction] Attempting to send announcement notification via API to: ${recipientEmails.join(', ')}`);
          const emailApiUrl = new URL('/api/send-email', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002').toString();
          const apiResponse = await fetch(emailApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: recipientEmails, subject: subject, html: fullEmailBody }),
          });
          const result = await apiResponse.json();
           if (!apiResponse.ok || !result.success) {
            console.error(`[postAnnouncementAction] Failed to send email via API: ${result.message || apiResponse.statusText}`);
          } else {
            console.log(`[postAnnouncementAction] Email successfully dispatched via API: ${result.message}`);
          }
        } catch (apiError: any) {
          console.error(`[postAnnouncementAction] Error calling email API: ${apiError.message}`);
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
