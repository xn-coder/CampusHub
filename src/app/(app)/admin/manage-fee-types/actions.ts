
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeType, StudentFeePayment, PaymentStatus, FeeTypeInstallmentType } from '@/types';


// MOCK DATA STORE
let mockFeeTypes: FeeType[] = [
    { id: 'ft-1', school_id: 'mock-school', name: 'LATE_FEE', display_name: 'Late Submission Fee', installment_type: 'extra_charge', fee_category_id: '1', is_refundable: false, description: 'Penalty for late assignment submissions.' },
    { id: 'ft-2', school_id: 'mock-school', name: 'RE_EVAL_FEE', display_name: 'Re-evaluation Fee', installment_type: 'extra_charge', fee_category_id: '2', is_refundable: false, description: 'Fee for re-evaluating an exam paper.' },
    { id: 'ft-3', school_id: 'mock-school', name: 'TUTION_MONTHLY', display_name: 'Monthly Tuition', installment_type: 'installments', fee_category_id: '1', is_refundable: false, description: 'Regular monthly tuition fee.' },
];

let mockAssignedFeeTypes: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[] = [];


export async function getFeeTypesAction(schoolId: string): Promise<{ ok: boolean; message?: string; feeTypes?: FeeType[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  const feeTypesWithCategory = mockFeeTypes.map(ft => ({
      ...ft,
      fee_category: { name: `Category ${ft.fee_category_id}` } // Mock join
  }))
  return { ok: true, feeTypes: feeTypesWithCategory as any[] };
}

export async function createFeeTypeAction(
  input: Omit<FeeType, 'id'>
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const newFeeType: FeeType = { ...input, id: uuidv4() };
  mockFeeTypes.push(newFeeType);
  revalidatePath('/admin/manage-fee-types');
  return { ok: true, message: 'Fee Type created successfully (mock).', feeType: newFeeType };
}

export async function updateFeeTypeAction(
  id: string,
  input: Partial<Omit<FeeType, 'id'>>
): Promise<{ ok: boolean; message: string; feeType?: FeeType }> {
  const index = mockFeeTypes.findIndex(ft => ft.id === id);
  if (index === -1) {
    return { ok: false, message: "Fee Type not found." };
  }
  mockFeeTypes[index] = { ...mockFeeTypes[index], ...input };
  revalidatePath('/admin/manage-fee-types');
  return { ok: true, message: 'Fee Type updated successfully (mock).', feeType: mockFeeTypes[index] };
}

export async function deleteFeeTypeAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockFeeTypes = mockFeeTypes.filter(ft => ft.id !== id);
  revalidatePath('/admin/manage-fee-types');
  return { ok: true, message: 'Fee Type deleted successfully (mock).' };
}

export async function getAssignedFeesForFeeTypeAction(schoolId: string): Promise<{
    ok: boolean;
    fees?: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[];
    message?: string;
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ok: true, fees: [...mockAssignedFeeTypes] };
}


interface AssignFeeTypeInput {
  student_ids: string[];
  fee_type_id: string;
  amount: number;
  due_date?: string;
  school_id: string;
}

export async function assignFeeTypeToStudentsAction(
  input: AssignFeeTypeInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const { student_ids, fee_type_id, amount, due_date, school_id } = input;

    if (student_ids.length === 0 || !fee_type_id) {
        return { ok: false, message: "Students and a Fee Type must be selected.", assignmentsCreated: 0 };
    }
    
    let count = 0;
    const feeType = mockFeeTypes.find(ft => ft.id === fee_type_id);
    if (!feeType) return { ok: false, message: 'Fee type not found', assignmentsCreated: 0 };
    
    for (const studentId of student_ids) {
        const newFee = {
            id: uuidv4(),
            student_id: studentId,
            fee_category_id: null,
            fee_type_id: fee_type_id,
            assigned_amount: amount,
            due_date: due_date,
            notes: `Fee for: ${feeType.display_name}`,
            school_id: school_id,
            paid_amount: 0,
            status: 'Pending' as PaymentStatus,
            student: { name: `Student ${studentId.substring(0,4)}`, email: 'student@mock.com' },
            fee_category: { name: 'N/A' },
            fee_type: { name: feeType.name }
        };
        mockAssignedFeeTypes.push(newFee);
        count++;
    }
      
    revalidatePath('/admin/manage-fee-types');
    return { ok: true, message: `Successfully assigned fees to ${count} student(s) (mock).`, assignmentsCreated: count };
}
