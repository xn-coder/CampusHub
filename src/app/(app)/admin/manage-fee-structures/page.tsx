"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AcademicYear, ClassData, FeeCategory } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, LayoutGrid, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getManageFeeStructuresPageDataAction, getFeeStructureForClassAction, saveFeeStructureAction } from './actions';

async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', userId).single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}


export default function ManageFeeStructuresPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingStructure, setIsFetchingStructure] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  // Data for dropdowns
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>([]);
  const [allFeeCategories, setAllFeeCategories] = useState<FeeCategory[]>([]);
  
  // Selections and state for building the structure
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [currentStructure, setCurrentStructure] = useState<Record<string, number>>({});

  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getManageFeeStructuresPageDataAction(schoolId);
    if(result.ok) {
        setAllClasses(result.classes || []);
        setAllAcademicYears(result.academicYears || []);
        setAllFeeCategories(result.feeCategories || []);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchPageData(schoolId);
        } else {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
  }, [toast, fetchPageData]);

  useEffect(() => {
    async function fetchStructure() {
        if (!selectedClassId || !selectedAcademicYearId) {
            setCurrentStructure({});
            return;
        }
        setIsFetchingStructure(true);
        const result = await getFeeStructureForClassAction(selectedClassId, selectedAcademicYearId);
        if(result.ok && result.structure) {
            setCurrentStructure(result.structure.structure);
        } else {
            setCurrentStructure({});
        }
        setIsFetchingStructure(false);
    }
    fetchStructure();
  }, [selectedClassId, selectedAcademicYearId]);

  const handleAmountChange = (categoryId: string, amount: string) => {
    const newAmount = parseFloat(amount);
    setCurrentStructure(prev => {
        const newStructure = {...prev};
        if (!isNaN(newAmount) && newAmount > 0) {
            newStructure[categoryId] = newAmount;
        } else {
            delete newStructure[categoryId]; // Remove if amount is invalid or zero
        }
        return newStructure;
    });
  };

  const handleSaveStructure = async () => {
    if (!selectedClassId || !selectedAcademicYearId || !currentSchoolId || Object.keys(currentStructure).length === 0) {
        toast({ title: "Error", description: "Please select a year, class, and at least one fee category with an amount.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await saveFeeStructureAction(selectedClassId, selectedAcademicYearId, currentStructure, currentSchoolId);
    if (result.ok) {
        toast({ title: "Success", description: result.message });
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  }
  
  const totalAmount = Object.values(currentStructure).reduce((acc, amount) => acc + amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Structures"
        description="Define which fees and amounts apply to each class for a specific academic year."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees Management</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><LayoutGrid className="mr-2 h-5 w-5" />Fee Structure Builder</CardTitle>
          <CardDescription>First, select an academic year and a class to view or create its fee structure.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
                <Label>1. Select Academic Year</Label>
                <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId} disabled={isLoading}>
                    <SelectTrigger><SelectValue placeholder="Choose an academic year"/></SelectTrigger>
                    <SelectContent>{allAcademicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div>
                <Label>2. Select Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || !selectedAcademicYearId}>
                    <SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger>
                    <SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                </Select>
            </div>
          </div>

          {(isFetchingStructure) && (
             <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          )}

          {(!isFetchingStructure && selectedClassId && selectedAcademicYearId) && (
            <div className="border-t pt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fee Category</TableHead>
                            <TableHead className="w-1/3">Amount (₹)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allFeeCategories.map(category => (
                            <TableRow key={category.id}>
                                <TableCell>
                                    <Label htmlFor={`fee-${category.id}`} className="font-medium">{category.name}</Label>
                                    <p className="text-xs text-muted-foreground">{category.description}</p>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        id={`fee-${category.id}`}
                                        type="number"
                                        placeholder="Enter amount..."
                                        value={currentStructure[category.id] || ''}
                                        onChange={(e) => handleAmountChange(category.id, e.target.value)}
                                        min="0"
                                        step="0.01"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
         {selectedClassId && selectedAcademicYearId && !isFetchingStructure && (
            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-6">
                <div className="flex items-baseline gap-2">
                    <span className="text-lg text-muted-foreground">Total for this structure:</span>
                    <span className="text-2xl font-bold"><DollarSign className="inline-block h-5 w-5 mb-1" />{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSaveStructure} disabled={isSubmitting || Object.keys(currentStructure).length === 0}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Structure
                    </Button>
                     <Button disabled>Apply to Students (Coming Soon)</Button>
                </div>
            </CardFooter>
         )}
      </Card>
    </div>
  );
}
