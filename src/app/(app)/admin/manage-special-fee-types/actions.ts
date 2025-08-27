
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeType, StudentFeePayment, PaymentStatus, FeeTypeInstallmentType } from '@/types';


// MOCK DATA STORE
let mockSpecialFeeTypes: FeeType[] = [
    { id: 'sft-1', school_id: 'mock-school', name: 'SCIENCE_FAIR', display_name: 'Science Fair Fee', installment_type: 'extra_charge', fee_category_id: '1', is_refundable: false, description: 'Entry fee for the annual science fair.' },
    { id: 'sft-2', school_id: 'mock-school', name: 'FIELD_TRIP_MUSEUM', display_name: 'Museum Field Trip', installment_type: 'extra_charge', fee_category_id: '3', is_refundable: false, description: 'Fee for the history museum field trip.' },
];

let mockAssignedSpecialFees: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[] = [];


export async function getSpecialFeeTypesAction(schoolId: string): Promise<{ ok: boolean; message?: string; feeTypes?: FeeType[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  const feeTypesWithCategory = mockSpecialFeeTypes.map(ft => ({
      ...ft,
      fee_category: { name: `Category ${ft.fee_category_id}` } // Mock join
  }))
  return { ok: true, feeTypes: feeTypesWithCategory as any[] };
}

export async function createSpecialFeeTypeAction(
  input: Omit<FeeType, 'id'>
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const newFeeType: FeeType = { ...input, id: uuidv4() };
  mockSpecialFeeTypes.push(newFeeType);
  revalidatePath('/admin/manage-special-fee-types');
  return { ok: true, message: 'Special Fee Type created successfully (mock).', feeType: newFeeType };
}

export async function updateSpecialFeeTypeAction(
  id: string,
  input: Partial<Omit<FeeType, 'id'>>
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const index = mockSpecialFeeTypes.findIndex(ft => ft.id === id);
  if (index === -1) {
    return { ok: false, message: "Special Fee Type not found." };
  }
  mockSpecialFeeTypes[index] = { ...mockSpecialFeeTypes[index], ...input };
  revalidatePath('/admin/manage-special-fee-types');
  return { ok: true, message: 'Special Fee Type updated successfully (mock).', feeType: mockSpecialFeeTypes[index] };
}

export async function deleteSpecialFeeTypeAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockSpecialFeeTypes = mockSpecialFeeTypes.filter(ft => ft.id !== id);
  revalidatePath('/admin/manage-special-fee-types');
  return { ok: true, message: 'Special Fee Type deleted successfully (mock).' };
}

export async function getAssignedSpecialFeesAction(schoolId: string): Promise<{
    ok: boolean;
    fees?: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[]
    message?: string;
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ok: true, fees: [...mockAssignedSpecialFees] };
}


interface AssignFeeTypeInput {
  student_ids: string[];
  fee_type_id: string;
  amount: number;
  due_date?: string;
  school_id: string;
}

export async function assignSpecialFeeTypeToStudentsAction(
  input: AssignFeeTypeInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const { student_ids, fee_type_id, amount, due_date, school_id } = input;

    if (student_ids.length === 0 || !fee_type_id) {
        return { ok: false, message: "Students and a Special Fee Type must be selected.", assignmentsCreated: 0 };
    }
    
    let count = 0;
    const feeType = mockSpecialFeeTypes.find(ft => ft.id === fee_type_id);
    if (!feeType) return { ok: false, message: 'Special Fee type not found', assignmentsCreated: 0 };
    
    for (const studentId of student_ids) {
        const newFee = {
            id: uuidv4(),
            student_id: studentId,
            fee_category_id: null,
            fee_type_id: fee_type_id,
            assigned_amount: amount,
            due_date: due_date,
            notes: `Special Fee: ${feeType.display_name}`,
            school_id: school_id,
            paid_amount: 0,
            status: 'Pending' as PaymentStatus,
            student: { name: `Student ${studentId.substring(0,4)}`, email: 'student@mock.com' },
            fee_category: { name: 'N/A' },
            fee_type: { name: feeType.name }
        };
        mockAssignedSpecialFees.push(newFee);
        count++;
    }
      
    revalidatePath('/admin/manage-special-fee-types');
    return { ok: true, message: `Successfully assigned special fees to ${count} student(s) (mock).`, assignmentsCreated: count };
}
