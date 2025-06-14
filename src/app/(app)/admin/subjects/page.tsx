
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Subject, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, BookOpenText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_SUBJECTS_KEY = 'mockSubjectsData';
const MOCK_ACADEMIC_YEARS_KEY = 'mockAcademicYearsData';

export default function SubjectsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Form state
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
      if (storedSubjects) setSubjects(JSON.parse(storedSubjects));
      else localStorage.setItem(MOCK_SUBJECTS_KEY, JSON.stringify([]));

      const storedYears = localStorage.getItem(MOCK_ACADEMIC_YEARS_KEY);
      if (storedYears) setAcademicYears(JSON.parse(storedYears));
      else localStorage.setItem(MOCK_ACADEMIC_YEARS_KEY, JSON.stringify([]));
    }
  }, []);

  const updateLocalStorage = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setSubjectName('');
    setSubjectCode('');
    setSelectedAcademicYearId(undefined);
    setEditingSubject(null);
  };

  const handleOpenDialog = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setSubjectName(subject.name);
      setSubjectCode(subject.code);
      setSelectedAcademicYearId(subject.academicYearId);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCode.trim()) {
      toast({ title: "Error", description: "Subject Name and Code are required.", variant: "destructive" });
      return;
    }

    let updatedSubjects;
    if (editingSubject) {
      updatedSubjects = subjects.map(s =>
        s.id === editingSubject.id ? { ...s, name: subjectName.trim(), code: subjectCode.trim(), academicYearId: selectedAcademicYearId } : s
      );
      toast({ title: "Subject Updated", description: `${subjectName.trim()} has been updated.` });
    } else {
      const newSubject: Subject = {
        id: `sub-${Date.now()}`,
        name: subjectName.trim(),
        code: subjectCode.trim(),
        academicYearId: selectedAcademicYearId,
      };
      updatedSubjects = [newSubject, ...subjects];
      toast({ title: "Subject Added", description: `${subjectName.trim()} has been added.` });
    }
    
    setSubjects(updatedSubjects);
    updateLocalStorage(MOCK_SUBJECTS_KEY, updatedSubjects);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteSubject = (subjectId: string) => {
    // Potential: Check if subject is used in exams/schedules
    if (confirm("Are you sure you want to delete this subject?")) {
      const updatedSubjects = subjects.filter(s => s.id !== subjectId);
      setSubjects(updatedSubjects);
      updateLocalStorage(MOCK_SUBJECTS_KEY, updatedSubjects);
      toast({ title: "Subject Deleted", variant: "destructive" });
    }
  };

  const getAcademicYearName = (yearId?: string) => {
    if (!yearId) return 'N/A';
    const year = academicYears.find(y => y.id === yearId);
    return year ? year.name : 'N/A';
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const filteredSubjects = subjects.filter(subject => 
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (subject.academicYearId && getAcademicYearName(subject.academicYearId).toLowerCase().includes(searchTerm.toLowerCase()))
  );


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Subjects Management" 
        description="Define and manage subjects offered by the school, optionally linking them to academic years."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BookOpenText className="mr-2 h-5 w-5" />Subject List</CardTitle>
          <CardDescription>Manage school subjects and their details. Use the search to filter.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input 
              placeholder="Search by subject name, code, or academic year..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {filteredSubjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {searchTerm && subjects.length > 0 ? "No subjects match your search." : "No subjects defined yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>{subject.code}</TableCell>
                    <TableCell>{getAcademicYearName(subject.academicYearId)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(subject)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteSubject(subject.id)}>
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
            <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subjectName" className="text-right">Name</Label>
                <Input id="subjectName" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className="col-span-3" placeholder="e.g., Mathematics" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subjectCode" className="text-right">Code</Label>
                <Input id="subjectCode" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} className="col-span-3" placeholder="e.g., MATH101" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="academicYear" className="text-right">Academic Year</Label>
                <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select academic year (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_ay_selection">None</SelectItem>
                    {academicYears.length > 0 ? academicYears.map(year => (
                      <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                    )) : <SelectItem value="no_ay_found" disabled>No academic years defined</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingSubject ? 'Save Changes' : 'Add Subject'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
