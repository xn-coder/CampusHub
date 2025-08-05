
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { sendEmail } from '@/services/emailService';
import type { TCRequest, Student } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getStudentTCRequestPageDataAction(userId: string): Promise<{
    ok: boolean;
    studentId?: string | null;
    schoolId?: string | null;
    request?: TCRequest | null;
    message?: string;
}> {
    if (!userId) {
        return { ok: false, message: "User not identified." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data: studentProfile, error: profileError } = await supabase
            .from('students')
            .select('id, school_id')
            .eq('user_id', userId)
            .single();

        if (profileError || !studentProfile) {
            return { ok: false, message: "Could not load your student profile." };
        }

        const { data: tcRequest, error: requestError } = await supabase
            .from('tc_requests')
            .select('*')
            .eq('student_id', studentProfile.id)
            .eq('school_id', studentProfile.school_id)
            .maybeSingle();

        if (requestError) {
            console.error("Error fetching TC request status:", requestError);
            // Non-fatal, we can still show the request button
        }

        return {
            ok: true,
            studentId: studentProfile.id,
            schoolId: studentProfile.school_id,
            request: tcRequest || null,
        };

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
    // 1. Check for outstanding fees
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
    
    // 2. Fees are clear, so auto-approve and create the TC record
    const { error: insertError } = await supabase
        .from('tc_requests')
        .insert({ 
            student_id: studentId, 
            school_id: schoolId,
            status: 'Approved', // Auto-approve
            approved_date: new Date().toISOString()
        });
    
    if (insertError) {
        if (insertError.code === '23505') { // Unique constraint violation
            return { ok: false, message: "You already have a processed TC request." };
        }
        return { ok: false, message: `Failed to create request: ${insertError.message}`};
    }
    
    // Notify admin that a TC has been auto-issued
    const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('name, admin_email')
        .eq('id', schoolId)
        .single();
    
    if (schoolError || !schoolData || !schoolData.admin_email) {
        console.warn("Could not find school admin email for TC issuance notification:", schoolError);
    } else {
        const { data: studentData } = await supabase
            .from('students')
            .select('name, email')
            .eq('id', studentId)
            .single();

        const emailSubject = `Notice: Transfer Certificate Issued for ${studentData?.name || 'a student'}`;
        const emailBody = `<p>A Transfer Certificate has been automatically issued for ${studentData?.name || 'a student'} (ID: ${studentId}) following a request, as all their dues were cleared. This is for your records.</p>`;

        await sendEmail({
            to: schoolData.admin_email,
            subject: emailSubject,
            html: emailBody
        });
    }

    revalidatePath('/student/apply-tc');
    revalidatePath('/admin/tc-requests');
    return { ok: true, message: "Your fees are clear and your Transfer Certificate has been issued successfully. You can now view and download it." };

  } catch (e: any) {
    console.error("Unexpected error requesting TC:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
