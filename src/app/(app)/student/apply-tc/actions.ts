
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { sendEmail } from '@/services/emailService';
import type { TCRequest } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getStudentTCRequestStatusAction(studentId: string, schoolId: string): Promise<{
    ok: boolean,
    request?: TCRequest | null,
    message?: string,
}> {
    if (!studentId || !schoolId) return { ok: false, message: "Context missing." };
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase
            .from('tc_requests')
            .select('*')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .maybeSingle();

        if (error) throw error;
        return { ok: true, request: data };
    } catch (e: any) {
        return { ok: false, message: e.message };
    }
}


export async function requestTransferCertificateAction(
  studentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !schoolId) {
    return { ok: false, message: "Student and School IDs are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: pendingFees, error: feesError } = await supabase
      .from('student_fee_payments')
      .select('id, assigned_amount, paid_amount')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue']);

    if (feesError) {
      console.error("Error fetching student fee status for TC request:", feesError);
      return { ok: false, message: `Database error checking fees: ${feesError.message}` };
    }

    let totalDue = 0;
    if (pendingFees && pendingFees.length > 0) {
      totalDue = pendingFees.reduce((acc, fee) => acc + (fee.assigned_amount - fee.paid_amount), 0);
    }
    
    if (totalDue > 0) {
      return { ok: false, message: `Cannot request certificate. You have outstanding dues of ₹${totalDue.toFixed(2)}. Please clear them first.` };
    }
    
    const { error: insertError } = await supabase
        .from('tc_requests')
        .insert({ student_id: studentId, school_id: schoolId });
    
    if (insertError) {
        if (insertError.code === '23505') { // Unique constraint violation
            return { ok: false, message: "You already have a pending or processed TC request." };
        }
        return { ok: false, message: `Failed to create request: ${insertError.message}`};
    }
    
    // Notify admin
    const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('name, admin_email')
        .eq('id', schoolId)
        .single();
    
    if (schoolError || !schoolData || !schoolData.admin_email) {
        console.warn("Could not find school admin email for TC request notification:", schoolError);
    } else {
        const { data: studentData } = await supabase
            .from('students')
            .select('name, email')
            .eq('id', studentId)
            .single();

        const emailSubject = `New Transfer Certificate Request from ${studentData?.name || 'a student'}`;
        const emailBody = `<p>A new request for a Transfer Certificate has been submitted by ${studentData?.name || 'a student'} (ID: ${studentId}). Please log in to the admin dashboard to review and process it.</p>`;

        await sendEmail({
            to: schoolData.admin_email,
            subject: emailSubject,
            html: emailBody
        });
    }

    revalidatePath('/student/apply-tc');
    revalidatePath('/admin/tc-requests');
    return { ok: true, message: "Your request for a Transfer Certificate has been submitted successfully. The school administration has been notified." };

  } catch (e: any) {
    console.error("Unexpected error requesting TC:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
