
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Teacher, User, ClassData } from '@/types';

export async function getTeacherProfileDataAction(userId: string): Promise<{
    ok: boolean;
    message?: string;
    user?: User | null;
    teacher?: Teacher | null;
    classes?: ClassData[] | null;
    assignmentCount?: number;
}> {
    if (!userId) {
        return { ok: false, message: "User not identified." };
    }
    const supabase = createSupabaseServerClient();

    try {
        const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
        if (userError || !user) throw new Error(userError?.message || "User data not found.");

        const { data: teacher, error: teacherError } = await supabase.from('teachers').select('*').eq('user_id', userId).single();
        if (teacherError || !teacher) throw new Error(teacherError?.message || "Teacher profile not found.");

        const [assignmentRes, classRes] = await Promise.all([
            supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
            supabase.from('classes').select('*').eq('teacher_id', teacher.id)
        ]);

        if (assignmentRes.error) console.warn("Could not fetch assignment count:", assignmentRes.error.message);
        if (classRes.error) console.warn("Could not fetch class data:", classRes.error.message);
        
        return {
            ok: true,
            user: user as User,
            teacher: teacher as Teacher,
            classes: (classRes.data || []) as ClassData[],
            assignmentCount: assignmentRes.count || 0
        };

    } catch (error: any) {
        return { ok: false, message: error.message };
    }
}


export async function updateTeacherProfileAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const teacherId = formData.get('teacherId') as string;
  const userId = formData.get('userId') as string;
  const subject = formData.get('subject') as string | null;
  const profilePictureFile = formData.get('profilePictureFile') as File | null;

  if (!teacherId || !userId) {
    return { ok: false, message: "Teacher or User ID is missing." };
  }

  try {
    const { data: user, error: userError } = await supabase.from('users').select('id, school_id').eq('id', userId).single();
    if (userError || !user) {
        return { ok: false, message: "Unauthorized or invalid user."};
    }

    const updates: Partial<Teacher> = {
      subject: subject,
    };

    if (profilePictureFile && profilePictureFile.size > 0) {
      // Fetch old file path to delete it after new upload
      const { data: teacherData, error: fetchError } = await supabase.from('teachers').select('profile_picture_url').eq('id', teacherId).single();
      const oldFileUrl = teacherData?.profile_picture_url;

      const sanitizedFileName = profilePictureFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const schoolId = user.school_id || 'unknown-school';
      const filePath = `public/teacher-profiles/${schoolId}/${teacherId}-${uuidv4()}-${sanitizedFileName}`;
      
      const { error: uploadError } = await supabase.storage.from('campushub').upload(filePath, profilePictureFile, { upsert: true });
      if (uploadError) throw new Error(`Failed to upload new profile picture: ${uploadError.message}`);
      
      const { data: publicUrlData } = supabase.storage.from('campushub').getPublicUrl(filePath);
      if (!publicUrlData) throw new Error("Could not retrieve public URL for the uploaded file.");
      updates.profile_picture_url = publicUrlData.publicUrl;

      if (oldFileUrl && oldFileUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
        const oldFilePath = oldFileUrl.substring(oldFileUrl.indexOf('/public/'));
        const { error: deleteError } = await supabase.storage.from('campushub').remove([oldFilePath.replace('/public/','')]);
        if (deleteError) console.warn(`Failed to delete old profile picture: ${deleteError.message}`);
      }
    }

    const { error: updateError } = await supabase.from('teachers').update(updates).eq('id', teacherId);
    if (updateError) throw updateError;

    revalidatePath('/teacher/profile');
    revalidatePath('/dashboard');

    return { ok: true, message: "Your profile has been updated successfully." };

  } catch (error: any) {
    console.error("Error updating teacher profile:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
