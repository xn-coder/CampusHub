// src/services/emailService.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * MOCK Email Sending Service.
 * In a real application, this would integrate with an actual email provider.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; message: string }> {
  console.log("--- MOCK EMAIL SEND REQUEST ---");
  console.log("To:", Array.isArray(options.to) ? options.to.join(', ') : options.to);
  console.log("Subject:", options.subject);
  // console.log("HTML Body:", options.html); // Keep console clean for now
  console.log("--- END MOCK EMAIL ---");

  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 300)); 
  return { success: true, message: "Email queued for sending (mock)." };
}


// Helper functions to fetch email addresses - can be expanded or moved
export async function getStudentEmailsByClassId(classId: string, schoolId: string): Promise<string[]> {
  if (!classId || !schoolId) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('email')
    .eq('class_id', classId)
    .eq('school_id', schoolId);
  if (error || !data) {
    console.error("Error fetching student emails by class ID:", error);
    return [];
  }
  return data.map(s => s.email).filter(email => !!email) as string[];
}

export async function getTeacherEmailByTeacherProfileId(teacherProfileId: string): Promise<string | null> {
  if (!teacherProfileId) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('email')
    .eq('id', teacherProfileId) // Assuming teacherProfileId is teachers.id
    .single();
  if (error || !data) {
    console.error("Error fetching teacher email by teacher profile ID:", error);
    return null;
  }
  return data.email;
}

export async function getAllUserEmailsInSchool(schoolId: string, roles?: UserRole[]): Promise<string[]> {
  if (!schoolId) return [];
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('users')
    .select('email')
    .eq('school_id', schoolId);

  if (roles && roles.length > 0) {
    query = query.in('role', roles);
  }
  
  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching all user emails in school:", error);
    return [];
  }
  return data.map(u => u.email).filter(email => !!email) as string[];
}
