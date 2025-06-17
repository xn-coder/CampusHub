// src/services/emailService.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types';

// EmailJS configuration and sendEmail function have been moved to individual action files.
// This file now only contains helper functions for fetching email addresses.

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
    .eq('id', teacherProfileId) 
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
