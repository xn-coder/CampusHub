
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, CalendarRange } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';

const MOCK_ACADEMIC_YEARS_KEY = 'mockAcademicYearsData';

export default function AcademicYearsPage() {
  const { toast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const [yearName, setYearName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedYears = localStorage.getItem(MOCK_ACADEMIC_YEARS_KEY);
      if (storedYears) {
        setAcademicYears(JSON.parse(storedYears));
      } else {
        localStorage.setItem(MOCK_ACADEMIC_YEARS_KEY, JSON.stringify([]));
      }
    }
  }, []);

  const updateLocalStorage = (data: AcademicYear[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_ACADEMIC_YEARS_KEY, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setYearName('');
    setStartDate('');
    setEndDate('');
    setEditingYear(null);
  };

  const handleOpenDialog = (year?: AcademicYear) => {
    if (year) {
      setEditingYear(year);
      setYearName(year.name);
      setStartDate(year.startDate);
      setEndDate(year.endDate);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!yearName.trim() || !startDate || !endDate) {
      toast({ title: "Error", description: "Name, Start Date, and End Date are required.", variant: "destructive" });
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
        toast({ title: "Error", description: "Start Date must be before End Date.", variant: "destructive" });
        return;
    }

    let updatedYears;
    if (editingYear) {
      updatedYears = academicYears.map(y =>
        y.id === editingYear.id ? { ...y, name: yearName.trim(), startDate, endDate } : y
      );
      toast({ title: "Academic Year Updated", description: `${yearName.trim()} has been updated.` });
    } else {
      const newYear: AcademicYear = {
        id: `ay-${Date.now()}`,
        name: yearName.trim(),
        startDate,
        endDate,
      };
      updatedYears = [newYear, ...academicYears]; // Add to top
      toast({ title: "Academic Year Added", description: `${yearName.trim()} has been added.` });
    }
    
    updatedYears.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()); // Sort by newest start date
    setAcademicYears(updatedYears);
    updateLocalStorage(updatedYears);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteYear = (yearId: string) => {
    // Potential: Check if this year is used by any subjects/exams before deleting
    if (confirm("Are you sure you want to delete this academic year?")) {
      const updatedYears = academicYears.filter(y => y.id !== yearId);
      setAcademicYears(updatedYears);
      updateLocalStorage(updatedYears);
      toast({ title: "Academic Year Deleted", variant: "destructive" });
    }
  };

  const formatDateString = (dateString: string) => {
    if (!dateString) return 'N/A';
    const dateObj = parseISO(dateString);
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Academic Year Management" 
        description="Define and manage academic years for the school."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Academic Year
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarRange className="mr-2 h-5 w-5" />Academic Years</CardTitle>
          <CardDescription>List of all defined academic years, newest start date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {academicYears.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No academic years defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell>{formatDateString(year.startDate)}</TableCell>
                    <TableCell>{formatDateString(year.endDate)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(year)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteYear(year.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingYear ? 'Edit' : 'Add New'} Academic Year</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="yearName" className="text-right">Name</Label>
                <Input id="yearName" value={yearName} onChange={(e) => setYearName(e.target.value)} className="col-span-3" placeholder="e.g., 2024-2025" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startDate" className="text-right">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDate" className="text-right">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="col-span-3" required />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingYear ? 'Save Changes' : 'Add Year'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
