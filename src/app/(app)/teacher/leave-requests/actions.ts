
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { getLeaveRequestsAction } from '@/actions/leaveActions';
import type { StoredLeaveApplicationDB } from '@/types';

export async function getLeaveRequestsForTeacherAction(teacherUserId: string): Promise<{
    ok: boolean;
    applications?: StoredLeaveApplicationDB[];
    teacherProfileId?: string;
    schoolId?: string;
    message?: string;
}> {
    if (!teacherUserId) {
        return { ok: false, message: "Teacher user ID is required." };
    }
    const supabase = createSupabaseServerClient();
    try {
        const { data: teacherProfile, error: profileError } = await supabase
            .from('teachers')
            .select('id, school_id')
            .eq('user_id', teacherUserId)
            .single();

        if (profileError || !teacherProfile) {
            return { ok: false, message: profileError?.message || "Teacher profile not found." };
        }

        const { id: teacherProfileId, school_id: schoolId } = teacherProfile;
        if (!schoolId) {
            return { ok: false, message: "Teacher is not associated with a school." };
        }
        
        const leaveRequestsResult = await getLeaveRequestsAction({ 
          school_id: schoolId, 
          teacher_id: teacherProfileId, 
          target_role: 'student' 
        });

        if (!leaveRequestsResult.ok) {
            return { ok: false, message: leaveRequestsResult.message };
        }
        
        return {
            ok: true,
            applications: leaveRequestsResult.applications,
            teacherProfileId,
            schoolId,
        };

    } catch (e: any) {
        return { ok: false, message: `An unexpected error occurred: ${e.message}` };
    }
}
