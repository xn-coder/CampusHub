
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { PlusCircle, Edit2, Trash2, Save, Loader2 } from 'lucide-react';
import { useState, type FormEvent, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { addAcademicYearAction, updateAcademicYearAction, deleteAcademicYearAction } from './actions';
import { format } from 'date-fns';

// This type should ideally match the structure expected by the actions or a common DTO.
// For existingYear, it's what the page component provides after fetching.
interface AcademicYearDisplayType {
  id: string;
  name: string;
  startDate: Date; // Expecting Date object from page component
  endDate: Date;   // Expecting Date object from page component
  schoolId: string;
}

interface AcademicYearActionsProps {
  schoolId: string | null; 
  existingYear?: AcademicYearDisplayType; 
}

export default function AcademicYearActions({ schoolId, existingYear }: AcademicYearActionsProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [yearName, setYearName] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD string for input
  const [endDate, setEndDate] = useState('');   // YYYY-MM-DD string for input

  const isEditMode = !!existingYear;

  useEffect(() => {
    if (isEditMode && existingYear) {
      setYearName(existingYear.name);
      // Convert Date objects to YYYY-MM-DD string for date input
      setStartDate(format(new Date(existingYear.startDate), 'yyyy-MM-dd'));
      setEndDate(format(new Date(existingYear.endDate), 'yyyy-MM-dd'));
    } else {
      setYearName('');
      setStartDate('');
      setEndDate('');
    }
  }, [isEditMode, existingYear, isDialogOpen]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
        toast({ title: "Error", description: "Cannot determine school. Admin might not be linked to a school.", variant: "destructive" });
        return;
    }
    if (!yearName.trim() || !startDate || !endDate) {
      toast({ title: "Error", description: "Name, Start Date, and End Date are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    let result;
    const yearData = { name: yearName.trim(), startDate, endDate, school_id: schoolId }; // Use school_id for Supabase

    if (isEditMode && existingYear) {
      result = await updateAcademicYearAction({ ...yearData, id: existingYear.id });
    } else {
      result = await addAcademicYearAction(yearData);
    }
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: result.message });
      setIsDialogOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!existingYear) return;
    
    // Using native confirm for simplicity. Replace with AlertDialog for better UX if preferred.
    if (confirm(`Are you sure you want to delete the academic year "${existingYear.name}"?`)) {
      setIsSubmitting(true);
      const result = await deleteAcademicYearAction(existingYear.id);
      setIsSubmitting(false);
      if (result.ok) {
        toast({ title: result.message, variant: "destructive" }); // Changed to destructive for delete success
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    }
  };

  if (!schoolId && !existingYear) { 
    return (
      <Button disabled title="Admin not linked to a school">
        <PlusCircle className="mr-2 h-4 w-4" /> Add Academic Year
      </Button>
    );
  }
  
  if (!schoolId && existingYear) { 
     return <span className="text-xs text-destructive">Error: Admin not linked to school. Cannot perform actions.</span>;
  }

  if (existingYear) {
    return (
      <>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" title="Edit Academic Year">
              <Edit2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
           <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Academic Year</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="yearName" className="text-right">Name</Label>
                    <Input id="yearName" value={yearName} onChange={(e) => setYearName(e.target.value)} className="col-span-3" placeholder="e.g., 2024-2025" required disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="startDate" className="text-right">Start Date</Label>
                    <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="col-span-3" required disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="endDate" className="text-right">End Date</Label>
                    <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="col-span-3" required disabled={isSubmitting} />
                </div>
                </div>
                <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> {isEditMode ? 'Save Changes' : 'Add Year'}
                </Button>
                </DialogFooter>
            </form>
            </DialogContent>
        </Dialog>
        <Button variant="destructive" size="icon" onClick={handleDelete} disabled={isSubmitting} title="Delete Academic Year">
          {isSubmitting && isEditMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button disabled={!schoolId}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Academic Year
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
            <DialogTitle>Add New Academic Year</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="yearNameDialog" className="text-right">Name</Label>
                <Input id="yearNameDialog" value={yearName} onChange={(e) => setYearName(e.target.value)} className="col-span-3" placeholder="e.g., 2024-2025" required disabled={isSubmitting} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startDateDialog" className="text-right">Start Date</Label>
                <Input id="startDateDialog" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="col-span-3" required disabled={isSubmitting}/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDateDialog" className="text-right">End Date</Label>
                <Input id="endDateDialog" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="col-span-3" required disabled={isSubmitting}/>
            </div>
            </div>
            <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Add Year
            </Button>
            </DialogFooter>
        </form>
        </DialogContent>
    </Dialog>
  );
}
