
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ExpenseCategory } from '@/types';

// --- MOCK DATA ---
// This data will reset on every server restart.
let mockExpenseCategories: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Salaries', description: 'Monthly salaries for all staff.', school_id: 'mock-school-id' },
  { id: 'cat-2', name: 'Utilities', description: 'Electricity, water, and internet bills.', school_id: 'mock-school-id' },
  { id: 'cat-3', name: 'Maintenance', description: 'Building repairs and upkeep.', school_id: 'mock-school-id' },
  { id: 'cat-4', name: 'Office Supplies', description: 'Stationery and other office needs.', school_id: 'mock-school-id' },
];

interface ExpenseCategoryInput {
  name: string;
  description?: string;
  school_id: string;
}

export async function getExpenseCategoriesAction(schoolId: string): Promise<{ ok: boolean; message?: string; categories?: ExpenseCategory[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 300));
  return { ok: true, categories: mockExpenseCategories.filter(c => c.school_id === schoolId) };
}

export async function createExpenseCategoryAction(
  input: ExpenseCategoryInput
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const existing = mockExpenseCategories.find(c => c.name.toLowerCase() === input.name.toLowerCase() && c.school_id === input.school_id);
  if (existing) {
    return { ok: false, message: `An expense category named "${input.name}" already exists.` };
  }
  
  const newCategory: ExpenseCategory = {
    id: uuidv4(),
    ...input,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockExpenseCategories.push(newCategory);
  
  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category created successfully.', category: newCategory };
}

export async function updateExpenseCategoryAction(
  id: string,
  input: Partial<ExpenseCategoryInput> & { school_id: string }
): Promise<{ ok: boolean; message: string; category?: ExpenseCategory }> {
  const index = mockExpenseCategories.findIndex(c => c.id === id);
  if (index === -1) {
    return { ok: false, message: "Category not found." };
  }

  const updatedCategory = { ...mockExpenseCategories[index], ...input, updated_at: new Date().toISOString() };
  mockExpenseCategories[index] = updatedCategory;
  
  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category updated successfully.', category: updatedCategory };
}

export async function deleteExpenseCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  // In a real app, you'd check dependencies here (e.g., if any expenses use this category).
  const initialLength = mockExpenseCategories.length;
  mockExpenseCategories = mockExpenseCategories.filter(c => c.id !== id);

  if (mockExpenseCategories.length === initialLength) {
      return { ok: false, message: "Category not found." };
  }

  revalidatePath('/admin/expense-categories');
  revalidatePath('/admin/expenses');
  return { ok: true, message: 'Expense category deleted successfully.' };
}
