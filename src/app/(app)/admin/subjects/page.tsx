
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Subject, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, BookOpenText, Loader2, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getSubjectsPageDataAction, addSubjectAction, updateSubjectAction, deleteSubjectAction } from './actions';

export default function SubjectsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      loadInitialData(adminUserId);
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData(adminUserId: string) {
    setIsLoading(true);
    const result = await getSubjectsPageDataAction(adminUserId);
    if (result.ok) {
      setCurrentSchoolId(result.schoolId || null);
      setSubjects(result.subjects || []);
      setAcademicYears(result.academicYears || []);
    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
      setSubjects([]);
      setAcademicYears([]);
    }
    setIsLoading(false);
  }

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
      setSelectedAcademicYearId(subject.academic_year_id || undefined);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCode.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Subject Name, Code, and School context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const subjectData = {
      name: subjectName.trim(),
      code: subjectCode.trim(),
      academic_year_id: selectedAcademicYearId === 'none_ay_selection' ? null : selectedAcademicYearId,
      school_id: currentSchoolId,
    };

    let result;
    if (editingSubject) {
      result = await updateSubjectAction(editingSubject.id, subjectData);
    } else {
      result = await addSubjectAction(subjectData);
    }

    if (result.ok) {
      toast({ title: editingSubject ? "Subject Updated" : "Subject Added", description: result.message });
      resetForm();
      setIsDialogOpen(false);
      const adminUserId = localStorage.getItem('currentUserId');
      if (adminUserId) loadInitialData(adminUserId); 
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteSubject = async (subjectId: string) => {
    if (!currentSchoolId) return;
    if (confirm("Are you sure you want to delete this subject?")) {
      setIsSubmitting(true);
      const result = await deleteSubjectAction(subjectId, currentSchoolId);
      toast({ title: result.ok ? "Subject Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok) {
        const adminUserId = localStorage.getItem('currentUserId');
        if (adminUserId) loadInitialData(adminUserId);
      }
      setIsSubmitting(false);
    }
  };

  const getAcademicYearName = (yearId?: string | null) => {
    if (!yearId) return 'General';
    const year = academicYears.find(y => y.id === yearId);
    return year ? year.name : 'N/A';
  };
  
  const filteredSubjects = subjects.filter(subject => 
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (subject.academic_year_id && getAcademicYearName(subject.academic_year_id).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Subjects Management" 
        description="Define and manage subjects offered by the school, optionally linking them to academic years."
        actions={
          <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting || isLoading}>
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
              disabled={isLoading || !currentSchoolId}
            />
          </div>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage subjects.</p>
          ) : filteredSubjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {searchTerm && subjects.length > 0 ? "No subjects match your search." : "No subjects defined yet for this school."}
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
                    <TableCell>{getAcademicYearName(subject.academic_year_id)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(subject)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteSubject(subject.id)} disabled={isSubmitting}>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit' : 'Add New'} Subject</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="subjectName">Name</Label>
                <Input id="subjectName" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g., Mathematics" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="subjectCode">Code</Label>
                <Input id="subjectCode" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g., MATH101" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="academicYearId">Academic Year (Optional)</Label>
                <Select value={selectedAcademicYearId || 'none_ay_selection'} onValueChange={setSelectedAcademicYearId} disabled={isSubmitting}>
                  <SelectTrigger id="academicYearId">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_ay_selection">None (General Subject)</SelectItem>
                    {academicYears.length > 0 ? academicYears.map(year => (
                      <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                    )) : <SelectItem value="no_ay_found" disabled>No academic years defined</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingSubject ? 'Save Changes' : 'Add Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    