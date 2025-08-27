
'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import type { ClassData, AcademicYear, FeeCategory, FeeStructure } from '@/types';
import { getAcademicYearsForSchoolAction } from '../academic-years/actions';
import { getFeeCategoriesAction } from '../fee-categories/actions';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

export async function getManageFeeStructuresPageDataAction(schoolId: string): Promise<{
  ok: boolean;
  message?: string;
  classes?: ClassData[];
  academicYears?: AcademicYear[];
  feeCategories?: FeeCategory[];
}> {
    if(!schoolId) return { ok: false, message: "School ID is required." };
    const supabase = createSupabaseServerClient();
    
    const [yearsResult, categoriesResult, classesResult] = await Promise.all([
        getAcademicYearsForSchoolAction(schoolId),
        getFeeCategoriesAction(schoolId),
        supabase.from('classes').select('id, name, division').eq('school_id', schoolId)
    ]);
    
    return {
        ok: true,
        academicYears: yearsResult.years,
        feeCategories: categoriesResult.categories,
        classes: classesResult.data || [],
    };
}


export async function getFeeStructureForClassAction(classId: string, academicYearId: string): Promise<{
  ok: boolean;
  message?: string;
  structure?: FeeStructure;
}> {
    const supabase = createSupabaseServerClient();
    try {
        const { data, error } = await supabase.from('fee_structures')
            .select('*')
            .eq('class_id', classId)
            .eq('academic_year_id', academicYearId)
            .maybeSingle();
        if (error) throw error;
        return { ok: true, structure: data as FeeStructure | undefined };
    } catch(e: any) {
        return { ok: false, message: `Error fetching fee structure: ${e.message}`};
    }
}


export async function saveFeeStructureAction(
  classId: string,
  academicYearId: string,
  structure: Record<string, number>,
  schoolId: string
): Promise<{ ok: boolean; message: string; structure?: FeeStructure }> {
    const supabase = createSupabaseServerClient();
    try {
        const { error, data } = await supabase.from('fee_structures')
            .upsert({
                class_id: classId,
                academic_year_id: academicYearId,
                school_id: schoolId,
                structure: structure
            }, { onConflict: 'class_id, academic_year_id', ignoreDuplicates: false })
            .select()
            .single();

        if (error) throw error;
        revalidatePath('/admin/manage-fee-structures');
        return { ok: true, message: 'Fee structure saved successfully.', structure: data };
    } catch(e: any) {
        return { ok: false, message: `Error saving fee structure: ${e.message}`};
    }
}
