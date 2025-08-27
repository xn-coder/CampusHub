"use server";

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ClassData, AcademicYear, FeeCategory, FeeStructure } from '@/types';
import { getAcademicYearsForSchoolAction } from '../academic-years/actions';
import { getFeeCategoriesAction } from '../fee-categories/actions';

// MOCK DATA STORE
let mockFeeStructures: FeeStructure[] = [
    { id: 'fs-1', school_id: 'mock-school', class_id: 'cls-1', academic_year_id: 'ay-1', structure: { 'fc-1': 50000, 'fc-2': 5000 } },
];

export async function getManageFeeStructuresPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  message?: string;
  classes?: ClassData[];
  academicYears?: AcademicYear[];
  feeCategories?: FeeCategory[];
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    
    // In a real scenario, you'd fetch this from the DB. Here, we call other mock actions.
    const [yearsResult, categoriesResult] = await Promise.all([
        getAcademicYearsForSchoolAction(schoolId),
        getFeeCategoriesAction(schoolId)
    ]);
    
    // Simulate fetching classes
    const mockClasses: ClassData[] = [
      { id: 'cls-1', name: 'Grade 10', division: 'A', school_id: 'mock-school', class_name_id: 'cn-1', section_name_id: 'sn-1' },
      { id: 'cls-2', name: 'Grade 10', division: 'B', school_id: 'mock-school', class_name_id: 'cn-1', section_name_id: 'sn-2' },
      { id: 'cls-3', name: 'Grade 11', division: 'Science', school_id: 'mock-school', class_name_id: 'cn-2', section_name_id: 'sn-3' },
    ];
    
    return {
        ok: true,
        academicYears: yearsResult.years,
        feeCategories: categoriesResult.categories,
        classes: mockClasses,
    };
}


export async function getFeeStructureForClassAction(classId: string, academicYearId: string): Promise<{
  ok: boolean;
  message?: string;
  structure?: FeeStructure;
}> {
    await new Promise(res => setTimeout(res, 200));
    const structure = mockFeeStructures.find(s => s.class_id === classId && s.academic_year_id === academicYearId);
    return { ok: true, structure };
}


export async function saveFeeStructureAction(
  classId: string,
  academicYearId: string,
  structure: Record<string, number>,
  schoolId: string
): Promise<{ ok: boolean; message: string; structure?: FeeStructure }> {
    const existingIndex = mockFeeStructures.findIndex(s => s.class_id === classId && s.academic_year_id === academicYearId);
    
    if (existingIndex > -1) {
        // Update existing
        mockFeeStructures[existingIndex].structure = structure;
        revalidatePath('/admin/manage-fee-structures');
        return { ok: true, message: 'Fee structure updated successfully (mock).', structure: mockFeeStructures[existingIndex] };
    } else {
        // Create new
        const newStructure: FeeStructure = {
            id: uuidv4(),
            class_id: classId,
            academic_year_id: academicYearId,
            structure: structure,
            school_id: schoolId
        };
        mockFeeStructures.push(newStructure);
        revalidatePath('/admin/manage-fee-structures');
        return { ok: true, message: 'Fee structure created successfully (mock).', structure: newStructure };
    }
}
