"use server";

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Concession, StudentFeePayment, Student } from '@/types';

// MOCK DATA STORE
let mockConcessions: Concession[] = [
    { id: 'c-1', school_id: 'mock-school', title: 'Sibling Discount', description: 'Discount for siblings enrolled in the school.' },
    { id: 'c-2', school_id: 'mock-school', title: 'Merit Scholarship', description: 'Scholarship for academic excellence.' },
];

let mockAssignedConcessions: any[] = [];

// Simulate fetching student fees from another module
let mockStudentFees: StudentFeePayment[] = [
    { id: 'sfp-1', student_id: 's-1', fee_category_id: 'fc-1', assigned_amount: 5000, paid_amount: 0, status: 'Pending', school_id: 'mock-school' },
    { id: 'sfp-2', student_id: 's-1', fee_category_id: 'fc-2', assigned_amount: 1000, paid_amount: 0, status: 'Pending', school_id: 'mock-school' },
    { id: 'sfp-3', student_id: 's-2', fee_category_id: 'fc-1', assigned_amount: 5000, paid_amount: 2500, status: 'Partially Paid', school_id: 'mock-school' },
];

export async function getConcessionsAction(schoolId: string): Promise<{ ok: boolean; message?: string; concessions?: Concession[] }> {
  if (!schoolId) return { ok: false, message: "School ID is required." };
  await new Promise(resolve => setTimeout(resolve, 300));
  return { ok: true, concessions: [...mockConcessions] };
}

export async function createConcessionAction(input: Omit<Concession, 'id'>): Promise<{ ok: boolean; message: string; concession?: Concession }> {
  const newConcession: Concession = { ...input, id: uuidv4() };
  mockConcessions.push(newConcession);
  revalidatePath('/admin/manage-concessions');
  return { ok: true, message: 'Concession created successfully (mock).', concession: newConcession };
}

export async function updateConcessionAction(id: string, input: Partial<Omit<Concession, 'id'>>): Promise<{ ok: boolean; message: string; concession?: Concession }> {
  const index = mockConcessions.findIndex(c => c.id === id);
  if (index === -1) return { ok: false, message: "Concession not found." };
  mockConcessions[index] = { ...mockConcessions[index], ...input };
  revalidatePath('/admin/manage-concessions');
  return { ok: true, message: 'Concession updated successfully (mock).', concession: mockConcessions[index] };
}

export async function deleteConcessionAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockConcessions = mockConcessions.filter(c => c.id !== id);
  revalidatePath('/admin/manage-concessions');
  return { ok: true, message: 'Concession deleted successfully (mock).' };
}

export async function getAssignedConcessionsAction(schoolId: string): Promise<{ ok: boolean; assignedConcessions?: any[]; message?: string; }> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    await new Promise(resolve => setTimeout(resolve, 300));
    return { ok: true, assignedConcessions: [...mockAssignedConcessions] };
}

export async function getFeesForStudentsAction(studentIds: string[], schoolId: string): Promise<{ ok: boolean; fees?: StudentFeePayment[]; message?: string }> {
    if (!studentIds || !schoolId) return { ok: false, message: "Required data missing." };
    const fees = mockStudentFees.filter(f => studentIds.includes(f.student_id));
    return { ok: true, fees };
}


interface AssignConcessionInput {
  student_id: string;
  fee_payment_id: string;
  concession_id: string;
  amount: number;
  school_id: string;
}

export async function assignConcessionAction(input: AssignConcessionInput): Promise<{ ok: boolean; message: string; }> {
    const { fee_payment_id, concession_id, amount } = input;
    
    const feeIndex = mockStudentFees.findIndex(f => f.id === fee_payment_id);
    if (feeIndex === -1) return { ok: false, message: "Fee record not found."};
    
    const concession = mockConcessions.find(c => c.id === concession_id);
    if (!concession) return { ok: false, message: "Concession type not found."};

    const fee = mockStudentFees[feeIndex];
    if(amount > fee.assigned_amount - fee.paid_amount) {
        return { ok: false, message: "Concession amount cannot be greater than the due amount."};
    }

    // In a real scenario, this would likely create a separate concession record and link it.
    // For mock, we'll just reduce the assigned_amount.
    mockStudentFees[feeIndex].assigned_amount -= amount;

    mockAssignedConcessions.push({
        id: uuidv4(),
        ...input,
        student: { name: 'Mock Student' },
        fee: { categoryName: `Fee Cat ${fee.fee_category_id}`},
        concession: { title: concession.title }
    });
      
    revalidatePath('/admin/manage-concessions');
    revalidatePath('/admin/student-fees'); // Also revalidate student fees page
    return { ok: true, message: `Successfully applied concession of ₹${amount.toFixed(2)}.` };
}
