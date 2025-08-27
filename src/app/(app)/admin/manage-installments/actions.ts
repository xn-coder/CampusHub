
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Installment, StudentFeePayment, PaymentStatus } from '@/types';

// MOCK DATA STORE
let mockInstallments: Installment[] = [
    { id: 'inst-1', school_id: 'mock-school', title: 'First Term', start_date: '2024-04-01', end_date: '2024-07-31', last_date: '2024-08-15', description: 'First term fees for the academic year.'},
    { id: 'inst-2', school_id: 'mock-school', title: 'Second Term', start_date: '2024-08-01', end_date: '2024-11-30', last_date: '2024-12-15', description: 'Second term fees.'},
];

let mockAssignedFees: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, installment: {title: string}})[] = [];


export async function getInstallmentsAction(schoolId: string): Promise<{ ok: boolean; message?: string; installments?: Installment[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  return { ok: true, installments: [...mockInstallments] };
}

export async function createInstallmentAction(
  input: Omit<Installment, 'id'>
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const newInstallment: Installment = { ...input, id: uuidv4() };
  mockInstallments.push(newInstallment);
  revalidatePath('/admin/manage-installments');
  return { ok: true, message: 'Installment created successfully (mock).', installment: newInstallment };
}

export async function updateInstallmentAction(
  id: string,
  input: Partial<Omit<Installment, 'id'>>
): Promise<{ ok: boolean; message: string; installment?: Installment }> {
  const index = mockInstallments.findIndex(i => i.id === id);
  if (index === -1) {
    return { ok: false, message: "Installment not found." };
  }
  mockInstallments[index] = { ...mockInstallments[index], ...input };
  revalidatePath('/admin/manage-installments');
  return { ok: true, message: 'Installment updated successfully (mock).', installment: mockInstallments[index] };
}

export async function deleteInstallmentAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockInstallments = mockInstallments.filter(i => i.id !== id);
  revalidatePath('/admin/manage-installments');
  return { ok: true, message: 'Installment deleted successfully (mock).' };
}

export async function getAssignedFeesAction(schoolId: string): Promise<{
    ok: boolean;
    fees?: (StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, installment: {title: string}})[];
    message?: string;
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ok: true, fees: [...mockAssignedFees] };
}

interface AssignFeesInput {
  student_ids: string[];
  fee_category_ids: string[];
  installment_id: string;
  due_date?: string;
  school_id: string;
}

export async function assignFeesToStudentsAction(
  input: AssignFeesInput
): Promise<{ ok: boolean; message: string; assignmentsCreated: number }> {
    const { student_ids, fee_category_ids, installment_id, due_date, school_id } = input;
    let count = 0;
    // This is a simulation. In a real app, you'd fetch student and category names.
    for (const studentId of student_ids) {
        for (const catId of fee_category_ids) {
            const newFee = {
                id: uuidv4(),
                student_id: studentId,
                fee_category_id: catId,
                installment_id,
                assigned_amount: 5000, // mock amount
                paid_amount: 0,
                due_date,
                status: 'Pending' as PaymentStatus,
                school_id,
                student: { name: `Student ${studentId.substring(0,4)}`, email: 'student@mock.com' },
                fee_category: { name: `Fee Cat ${catId.substring(0,4)}` },
                installment: { title: `Installment ${installment_id.substring(0,4)}` }
            };
            mockAssignedFees.push(newFee);
            count++;
        }
    }
    revalidatePath('/admin/manage-installments');
    return { ok: true, message: `Successfully assigned ${count} new fee records.`, assignmentsCreated: count };
}
