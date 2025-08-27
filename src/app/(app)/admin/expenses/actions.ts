
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { Expense, ExpenseCategory, User, SchoolDetails } from '@/types';
import { format } from 'date-fns';

// --- MOCK DATA ---
let mockExpenses: Expense[] = [
    { id: 'exp-1', title: 'January Electricity Bill', amount: 15000, category_id: 'cat-2', date: format(new Date(), 'yyyy-MM-dd'), school_id: 'mock-school-id', recorded_by_user_id: 'user-admin', created_at: new Date().toISOString() },
    { id: 'exp-2', title: 'Teacher Salaries - Jan', amount: 250000, category_id: 'cat-1', date: format(new Date(), 'yyyy-MM-dd'), school_id: 'mock-school-id', recorded_by_user_id: 'user-admin', created_at: new Date().toISOString() },
    { id: 'exp-3', title: 'New Whiteboards', amount: 8000, category_id: 'cat-4', date: '2024-05-10', school_id: 'mock-school-id', recorded_by_user_id: 'user-admin', created_at: new Date().toISOString() },
];
let mockCategories: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Salaries', description: 'Monthly salaries for all staff.', school_id: 'mock-school-id' },
  { id: 'cat-2', name: 'Utilities', description: 'Electricity, water, and internet bills.', school_id: 'mock-school-id' },
  { id: 'cat-3', name: 'Maintenance', description: 'Building repairs and upkeep.', school_id: 'mock-school-id' },
  { id: 'cat-4', name: 'Office Supplies', description: 'Stationery and other office needs.', school_id: 'mock-school-id' },
];

let mockUsers: User[] = [ { id: 'user-admin', name: 'Admin User', email: 'admin@example.com', role: 'admin' } ];
let mockSchool: SchoolDetails = { id: 'mock-school-id', name: 'CampusHub Demo School', address: '123 Innovation Drive', admin_email: 'admin@example.com', admin_name: 'Admin User', status: 'Active' };


interface ExpenseInput {
  title: string;
  amount: number;
  category_id: string;
  date: string;
  receipt_url?: string | null;
  notes?: string | null;
  school_id: string;
  recorded_by_user_id: string;
}

export async function createExpenseAction(
  input: ExpenseInput
): Promise<{ ok: boolean; message: string; expense?: Expense }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newExpense: Expense = {
    id: uuidv4(),
    ...input,
    created_at: new Date().toISOString(),
  };
  mockExpenses.unshift(newExpense);
  revalidatePath('/admin/expenses');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Expense created successfully.', expense: newExpense };
}

export async function getExpensesPageDataAction(schoolId: string): Promise<{
    ok: boolean;
    expenses?: Expense[];
    categories?: ExpenseCategory[];
    message?: string;
}> {
    if (!schoolId) {
        return { ok: false, message: "School ID is required." };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    const schoolExpenses = mockExpenses
      .filter(exp => exp.school_id === schoolId)
      .map(exp => ({
        ...exp,
        category: mockCategories.find(c => c.id === exp.category_id),
        recorded_by: mockUsers.find(u => u.id === exp.recorded_by_user_id)
      }));
      
    return {
        ok: true,
        expenses: schoolExpenses,
        categories: mockCategories,
    };
}


export async function updateExpenseAction(
  id: string,
  input: Partial<ExpenseInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; expense?: Expense }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockExpenses.findIndex(e => e.id === id);
  if (index === -1) {
    return { ok: false, message: 'Expense not found.' };
  }
  mockExpenses[index] = { ...mockExpenses[index], ...input, updated_at: new Date().toISOString() };
  revalidatePath('/admin/expenses');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Expense updated successfully.', expense: mockExpenses[index] };
}


export async function deleteExpenseAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const initialLength = mockExpenses.length;
  mockExpenses = mockExpenses.filter(e => e.id !== id);
  if (mockExpenses.length === initialLength) {
    return { ok: false, message: "Expense not found." };
  }
  revalidatePath('/admin/expenses');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Expense deleted successfully.' };
}


export async function getExpenseVoucherDataAction(expenseId: string): Promise<{
  ok: boolean;
  expense?: Expense;
  school?: SchoolDetails;
  message?: string;
}> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const expense = mockExpenses.find(e => e.id === expenseId);
  if (!expense) {
    return { ok: false, message: "Expense record not found." };
  }
  const enrichedExpense = {
    ...expense,
    category: mockCategories.find(c => c.id === expense.category_id)
  };
  return {
    ok: true,
    expense: enrichedExpense,
    school: mockSchool,
  };
}
