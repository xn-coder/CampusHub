
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';

export async function updateStudentProfileAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  
  const studentId = formData.get('studentId') as string;
  const userId = formData.get('userId') as string;
  const guardianName = formData.get('guardianName') as string | null;
  const contactNumber = formData.get('contactNumber') as string | null;
  const address = formData.get('address') as string | null;
  const bloodGroup = formData.get('bloodGroup') as string | null;
  const profilePictureFile = formData.get('profilePictureFile') as File | null;

  if (!studentId || !userId) {
    return { ok: false, message: "Student or User ID is missing." };
  }

  try {
    const { data: user, error: userError } = await supabase.from('users').select('id').eq('id', userId).single();
    if (userError || !user) {
        return { ok: false, message: "Unauthorized or invalid user."};
    }

    const updates: any = {
      guardian_name: guardianName,
      contact_number: contactNumber,
      address: address,
      blood_group: bloodGroup,
    };

    if (profilePictureFile && profilePictureFile.size > 0) {
      // Fetch old file path to delete it after new upload
      const { data: studentData, error: fetchError } = await supabase
        .from('students')
        .select('profile_picture_url')
        .eq('id', studentId)
        .single();
      
      const oldFileUrl = studentData?.profile_picture_url;

      const sanitizedFileName = profilePictureFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const schoolId = (await supabase.from('students').select('school_id').eq('id', studentId).single()).data?.school_id || 'unknown-school';
      const filePath = `public/student-profiles/${schoolId}/${studentId}-${uuidv4()}-${sanitizedFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('campushub')
        .upload(filePath, profilePictureFile);

      if (uploadError) {
        throw new Error(`Failed to upload new profile picture: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('campushub')
        .getPublicUrl(filePath);

      if (!publicUrlData) {
        throw new Error("Could not retrieve public URL for the uploaded file.");
      }

      updates.profile_picture_url = publicUrlData.publicUrl;

      // Delete old profile picture if it exists and is a Supabase storage URL
      if (oldFileUrl && oldFileUrl.includes(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
        const oldFilePath = oldFileUrl.substring(oldFileUrl.indexOf('/public/'));
        const { error: deleteError } = await supabase.storage.from('campushub').remove([oldFilePath.replace('/public/','')]);
        if (deleteError) {
            console.warn(`Failed to delete old profile picture: ${deleteError.message}`);
        }
      }
    }

    const { error: updateError } = await supabase
      .from('students')
      .update(updates)
      .eq('id', studentId);

    if (updateError) {
      throw updateError;
    }

    revalidatePath('/student/my-profile');
    revalidatePath('/dashboard');

    return { ok: true, message: "Your profile has been updated successfully." };

  } catch (error: any) {
    console.error("Error updating student profile:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
