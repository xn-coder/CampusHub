
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeTypeGroup, StudentFeePayment, PaymentStatus, FeeType } from '@/types';

// MOCK DATA STORE
let mockFeeGroups: FeeTypeGroup[] = [
    { id: 'fg-1', school_id: 'mock-school', name: 'Annual School Fees', fee_type_ids: ['ft-1', 'ft-3'] },
    { id: 'fg-2', school_id: 'mock-school', name: 'New Admission Pack', fee_type_ids: ['ft-2', 'ft-3'] },
];

let mockAssignedGroups: (StudentFeePayment & { student: {name: string, email: string}, fee_type_group: {name: string}})[] = [];

export async function getFeeTypeGroupsAction(schoolId: string): Promise<{ ok: boolean; message?: string; groups?: FeeTypeGroup[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  return { ok: true, groups: [...mockFeeGroups] };
}

export async function createFeeTypeGroupAction(
  input: Omit<FeeTypeGroup, 'id'>
): Promise<{ ok: boolean; message: string; group?: FeeTypeGroup }> {
  const newGroup: FeeTypeGroup = { ...input, id: uuidv4() };
  mockFeeGroups.push(newGroup);
  revalidatePath('/admin/manage-fee-groups');
  return { ok: true, message: 'Fee Group created successfully (mock).', group: newGroup };
}

export async function updateFeeTypeGroupAction(
  id: string,
  input: Partial<Omit<FeeTypeGroup, 'id'>>
): Promise<{ ok: boolean; message: string; group?: FeeTypeGroup }> {
  const index = mockFeeGroups.findIndex(g => g.id === id);
  if (index === -1) {
    return { ok: false, message: "Fee Group not found." };
  }
  mockFeeGroups[index] = { ...mockFeeGroups[index], ...input };
  revalidatePath('/admin/manage-fee-groups');
  return { ok: true, message: 'Fee Group updated successfully (mock).', group: mockFeeGroups[index] };
}

export async function deleteFeeTypeGroupAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockFeeGroups = mockFeeGroups.filter(g => g.id !== id);
  revalidatePath('/admin/manage-fee-groups');
  return { ok: true, message: 'Fee Group deleted successfully (mock).' };
}

export async function getAssignedFeeGroupsAction(schoolId: string): Promise<{
    ok: boolean;
    assignedGroups?: (StudentFeePayment & { student: {name: string, email: string}, fee_type_group: {name: string}})[];
    message?: string;
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ok: true, assignedGroups: [...mockAssignedGroups] };
}


interface AssignFeeGroupInput {
  student_ids: string[];
  fee_group_id: string;
  school_id: string;
}

export async function assignFeeGroupToStudentsAction(
  input: AssignFeeGroupInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const { student_ids, fee_group_id, school_id } = input;

    if (student_ids.length === 0 || !fee_group_id) {
        return { ok: false, message: "Students and a Fee Group must be selected.", assignmentsCreated: 0 };
    }
    
    let count = 0;
    const feeGroup = mockFeeGroups.find(fg => fg.id === fee_group_id);
    if (!feeGroup) return { ok: false, message: 'Fee group not found', assignmentsCreated: 0 };
    
    for (const studentId of student_ids) {
        // This is a simplified mock. In reality, you'd create multiple student_fee_payments, one for each fee type in the group.
        const newFee = {
            id: uuidv4(),
            student_id: studentId,
            fee_category_id: null,
            fee_type_id: null, // Assigning group, not individual type
            fee_type_group_id: fee_group_id,
            assigned_amount: 10000, // Mock amount for the whole group
            due_date: new Date().toISOString(),
            notes: `Fee for group: ${feeGroup.name}`,
            school_id: school_id,
            paid_amount: 0,
            status: 'Pending' as PaymentStatus,
            student: { name: `Student ${studentId.substring(0,4)}`, email: 'student@mock.com' },
            fee_category: { name: 'N/A' },
            fee_type_group: { name: feeGroup.name }
        };
        mockAssignedGroups.push(newFee);
        count++;
    }
      
    revalidatePath('/admin/manage-fee-groups');
    return { ok: true, message: `Successfully assigned group to ${count} student(s) (mock).`, assignmentsCreated: count };
}
