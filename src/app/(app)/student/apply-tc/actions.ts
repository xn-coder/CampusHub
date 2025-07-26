
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { sendEmail } from '@/services/emailService';

export async function requestTransferCertificateAction(
  studentId: string,
  schoolId: string
): Promise<{ ok: boolean; message: string }> {
  if (!studentId || !schoolId) {
    return { ok: false, message: "Student and School IDs are required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data: pendingFees, error } = await supabase
      .from('student_fee_payments')
      .select('id, assigned_amount, paid_amount')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .in('status', ['Pending', 'Partially Paid', 'Overdue']);

    if (error) {
      console.error("Error fetching student fee status for TC request:", error);
      return { ok: false, message: `Database error checking fees: ${error.message}` };
    }

    let totalDue = 0;
    if (pendingFees && pendingFees.length > 0) {
      totalDue = pendingFees.reduce((acc, fee) => acc + (fee.assigned_amount - fee.paid_amount), 0);
    }
    
    if (totalDue > 0) {
      return { ok: false, message: `Cannot request certificate. You have outstanding dues of ₹${totalDue.toFixed(2)}. Please clear them first.` };
    }

    // Since there's no "tc_requests" table, we will send an email to the admin
    const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('name, admin_email')
        .eq('id', schoolId)
        .single();
    
    if (schoolError || !schoolData || !schoolData.admin_email) {
        console.error("Could not find school admin email for TC request notification:", schoolError);
        return { ok: false, message: "Could not notify administration. Please contact them directly."};
    }

    const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('name, email')
        .eq('id', studentId)
        .single();
    
    if (studentError || !studentData) {
        return { ok: false, message: "Could not retrieve your student details." };
    }

    const emailSubject = `Transfer Certificate Request from ${studentData.name}`;
    const emailBody = `
        <h1>New Transfer Certificate Request</h1>
        <p>A new request for a Transfer Certificate has been submitted by:</p>
        <ul>
            <li><strong>Student Name:</strong> ${studentData.name}</li>
            <li><strong>Student ID:</strong> ${studentId}</li>
            <li><strong>Student Email:</strong> ${studentData.email}</li>
        </ul>
        <p>The system has verified that the student has <strong>no outstanding fee dues</strong>.</p>
        <p>Please log in to the admin dashboard, navigate to "Manage Students", and use the "Generate TC" option for this student to issue the certificate.</p>
    `;

    await sendEmail({
        to: schoolData.admin_email,
        subject: emailSubject,
        html: emailBody
    });

    return { ok: true, message: "Your request for a Transfer Certificate has been submitted. The school administration has been notified." };

  } catch (e: any) {
    console.error("Unexpected error requesting TC:", e);
    return { ok: false, message: `Unexpected error: ${e.message}` };
  }
}
