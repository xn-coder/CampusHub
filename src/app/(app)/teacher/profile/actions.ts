
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

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

    const updates: any = {
      subject: subject,
    };

    if (profilePictureFile && profilePictureFile.size > 0) {
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
