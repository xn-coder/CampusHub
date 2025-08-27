
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { FeeCategory } from '@/types';

// Mock data store
let mockFeeCategories: FeeCategory[] = [
  { id: '1', name: 'Tuition Fee', description: 'Annual tuition fee', amount: 50000, school_id: 'mock-school-id', created_at: new Date().toISOString() },
  { id: '2', name: 'Lab Fee', description: 'Science lab usage fee', amount: 5000, school_id: 'mock-school-id', created_at: new Date().toISOString() },
  { id: '3', name: 'Sports Fee', description: 'Fee for sports activities', amount: 3000, school_id: 'mock-school-id', created_at: new Date().toISOString() },
];


export async function getFeeCategoriesAction(schoolId: string): Promise<{ ok: boolean; message?: string; categories?: FeeCategory[] }> {
  if (!schoolId) {
    return { ok: false, message: "School ID is required." };
  }
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return { ok: true, categories: mockFeeCategories };
}


export async function createFeeCategoryAction(
  input: { name: string; description?: string; amount?: number; school_id: string; }
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
  const newCategory: FeeCategory = {
    id: uuidv4(),
    name: input.name,
    description: input.description,
    amount: input.amount,
    school_id: input.school_id,
    created_at: new Date().toISOString(),
  };
  mockFeeCategories.push(newCategory);
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category created successfully (mock).', category: newCategory };
}

export async function updateFeeCategoryAction(
  id: string,
  input: Partial<{ name: string; description?: string; amount?: number; }>
): Promise<{ ok: boolean; message: string; category?: FeeCategory }> {
  const index = mockFeeCategories.findIndex(c => c.id === id);
  if (index === -1) {
    return { ok: false, message: "Category not found." };
  }
  mockFeeCategories[index] = { ...mockFeeCategories[index], ...input };
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category updated successfully (mock).', category: mockFeeCategories[index] };
}

export async function deleteFeeCategoryAction(id: string, schoolId: string): Promise<{ ok: boolean; message: string }> {
  mockFeeCategories = mockFeeCategories.filter(c => c.id !== id);
  revalidatePath('/admin/fee-categories');
  return { ok: true, message: 'Fee category deleted successfully (mock).' };
}
    
