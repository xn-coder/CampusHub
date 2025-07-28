
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { TCRequest } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getTCRequestsForSchoolAction(schoolId: string): Promise<{
  ok: boolean;
  requests?: TCRequest[];
  message?: string;
}> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from('tc_requests')
      .select('*, student:student_id(*, class:class_id(name, division))')
      .eq('school_id', schoolId)
      .order('request_date', { ascending: false });

    if (error) throw new Error(`DB error fetching TC requests: ${error.message}`);
    
    return { ok: true, requests: data as TCRequest[] };

  } catch (e: any) {
    return { ok: false, message: e.message || "An unexpected error occurred." };
  }
}

export async function approveTCRequestAction(requestId: string): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
        .from('tc_requests')
        .update({
            status: 'Approved',
            approved_date: new Date().toISOString(),
            rejection_reason: null
        })
        .eq('id', requestId);

    if (error) {
        return { ok: false, message: `Failed to approve request: ${error.message}`};
    }
    revalidatePath('/admin/tc-requests');
    revalidatePath('/student/apply-tc');
    return { ok: true, message: 'TC Request approved.' };
}

interface RejectTCRequestInput {
    requestId: string;
    reason: string;
}
export async function rejectTCRequestAction(input: RejectTCRequestInput): Promise<{ ok: boolean; message: string }> {
    const supabase = createSupabaseServerClient();
    const { requestId, reason } = input;

    if (!reason.trim()) {
        return { ok: false, message: "A reason is required for rejection."};
    }

    const { error } = await supabase
        .from('tc_requests')
        .update({
            status: 'Rejected',
            rejection_reason: reason
        })
        .eq('id', requestId);

    if (error) {
        return { ok: false, message: `Failed to reject request: ${error.message}`};
    }
    revalidatePath('/admin/tc-requests');
    revalidatePath('/student/apply-tc');
    return { ok: true, message: 'TC Request rejected.' };
}
