
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeTypeGroup, StudentFeePayment, PaymentStatus, FeeType, Student, ClassData } from '@/types';


export async function getFeeTypeGroupsPageDataAction(schoolId: string): Promise<{
    ok: boolean;
    groups?: FeeTypeGroup[];
    assignedGroups?: any[];
    students?: Student[];
    classes?: ClassData[];
    feeTypes?: FeeType[];
    message?: string;
}> {
  if (!schoolId) return { ok: false, message: "School ID is required." };
  const supabase = createSupabaseServerClient();
  try {
    const [groupsRes, assignedGroupsRes, studentsRes, feeTypesRes, classesRes] = await Promise.all([
      supabase.from('fee_type_groups').select('*').eq('school_id', schoolId),
      supabase.from('student_fee_payments').select('*, student:student_id(name, email), fee_type_group:fee_type_group_id(name)').eq('school_id', schoolId).not('fee_type_group_id', 'is', null),
      supabase.from('students').select('*').eq('school_id', schoolId),
      supabase.from('fee_types').select('*').eq('school_id', schoolId),
      supabase.from('classes').select('*').eq('school_id', schoolId),
    ]);

    if (groupsRes.error) throw new Error(`Fee Groups: ${groupsRes.error.message}`);
    if (assignedGroupsRes.error) throw new Error(`Assigned Groups: ${assignedGroupsRes.error.message}`);
    if (studentsRes.error) throw new Error(`Students: ${studentsRes.error.message}`);
    if (feeTypesRes.error) throw new Error(`Fee Types: ${feeTypesRes.error.message}`);
    if (classesRes.error) throw new Error(`Classes: ${classesRes.error.message}`);

    return {
      ok: true,
      groups: groupsRes.data || [],
      assignedGroups: assignedGroupsRes.data || [],
      students: studentsRes.data || [],
      classes: classesRes.data || [],
      feeTypes: feeTypesRes.data || [],
    };
  } catch (e: any) {
    return { ok: false, message: `Failed to load page data: ${e.message}` };
  }
}

export async function createFeeTypeGroupAction(input: Omit<FeeTypeGroup, 'id'>): Promise<{ ok: boolean; message: string, group?: FeeTypeGroup }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase.from('fee_type_groups').insert({ ...input, id: uuidv4() }).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-fee-groups');
    return { ok: true, message: 'Fee type group created.', group: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to create group: ${e.message}` };
  }
}

export async function updateFeeTypeGroupAction(id: string, input: Partial<Omit<FeeTypeGroup, 'id'>>): Promise<{ ok: boolean; message: string, group?: FeeTypeGroup }> {
  const supabase = createSupabaseServerClient();
  try {
    const { data, error } = await supabase.from('fee_type_groups').update(input).eq('id', id).select().single();
    if (error) throw error;
    revalidatePath('/admin/manage-fee-groups');
    return { ok: true, message: 'Fee type group updated.', group: data };
  } catch (e: any) {
    return { ok: false, message: `Failed to update group: ${e.message}` };
  }
}

export async function deleteFeeTypeGroupAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createSupabaseServerClient();
  try {
    const { count } = await supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('fee_type_group_id', id);
    if (count && count > 0) return { ok: false, message: `Cannot delete: this group is used in ${count} fee record(s).` };
    
    const { error } = await supabase.from('fee_type_groups').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    revalidatePath('/admin/manage-fee-groups');
    return { ok: true, message: 'Fee type group deleted.' };
  } catch (e: any) {
    return { ok: false, message: `Failed to delete group: ${e.message}` };
  }
}

export async function assignFeeGroupToStudentsAction(input: { student_ids: string[], fee_group_id: string, school_id: string, amounts: Record<string, number> }): Promise<{ ok: boolean; message: string; assignmentsCreated?: number }> {
    const { student_ids, fee_group_id, school_id, amounts } = input;
    if (student_ids.length === 0 || !fee_group_id) {
        return { ok: false, message: "Students and a fee group must be selected." };
    }
    
    const supabase = createSupabaseServerClient();
    try {
        const { data: group, error: groupError } = await supabase.from('fee_type_groups').select('fee_type_ids').eq('id', fee_group_id).single();
        if (groupError || !group) return { ok: false, message: "Fee group not found." };
        
        const { data: feeTypes, error: typesError } = await supabase.from('fee_types').select('id, fee_category_id, amount').in('id', group.fee_type_ids);
        if (typesError || !feeTypes) return { ok: false, message: "Could not retrieve fee types for the selected group." };
        
        let newAssignments: any[] = [];
        for (const studentId of student_ids) {
            for (const feeType of feeTypes) {
                const assignedAmount = amounts[feeType.id] ?? feeType.amount ?? 0;
                if (assignedAmount > 0) { // Only assign if there's an amount
                    newAssignments.push({
                        id: uuidv4(),
                        student_id: studentId,
                        fee_category_id: feeType.fee_category_id,
                        fee_type_id: feeType.id,
                        fee_type_group_id: fee_group_id,
                        assigned_amount: assignedAmount,
                        paid_amount: 0,
                        status: 'Pending' as PaymentStatus,
                        school_id: school_id
                    });
                }
            }
        }
        
        if (newAssignments.length > 0) {
            const { error: insertError, count } = await supabase.from('student_fee_payments').insert(newAssignments);
            if (insertError) throw insertError;
            revalidatePath('/admin/manage-fee-groups');
            return { ok: true, message: `Successfully assigned ${count} fee records.`, assignmentsCreated: count || 0 };
        }
        return { ok: true, message: "No new assignments were created (amounts might be zero)." };
    } catch(e: any) {
        return { ok: false, message: `Failed to assign group: ${e.message}`};
    }
}
