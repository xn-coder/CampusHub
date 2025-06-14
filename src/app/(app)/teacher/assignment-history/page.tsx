
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Assignment, ClassData } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ScrollText, CalendarDays, ClipboardList, Info, Edit2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MOCK_ASSIGNMENTS_KEY = 'mockAssignmentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';

export default function TeacherAssignmentHistoryPage() {
  const { toast } = useToast();
  const [postedAssignments, setPostedAssignments] = useState<Assignment[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  // Target class remains non-editable for this iteration

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedAssignments = localStorage.getItem(MOCK_ASSIGNMENTS_KEY);
      const allAssignmentsData: Assignment[] = storedAssignments ? JSON.parse(storedAssignments) : [];
      
      const storedClassesData = localStorage.getItem(MOCK_CLASSES_KEY);
      setAllClasses(storedClassesData ? JSON.parse(storedClassesData) : []);

      if (teacherId) {
        const teacherSpecificAssignments = allAssignmentsData
          .filter(asm => asm.teacherId === teacherId)
          .sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime()); 
        setPostedAssignments(teacherSpecificAssignments);
      }
      setIsLoading(false);
    }
  }, []);

  const getClassSectionName = (classSectionId: string): string => {
    const cls = allClasses.find(c => c.id === classSectionId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };

  const handleOpenEditDialog = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description);
    setEditDueDate(assignment.dueDate);
    setIsEditDialogOpen(true);
  };

  const handleUpdateAssignment = (e: FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !editTitle.trim() || !editDescription.trim() || !editDueDate) {
      toast({ title: "Error", description: "Title, Description, and Due Date are required.", variant: "destructive"});
      return;
    }

    const updatedAssignment: Assignment = {
      ...editingAssignment,
      title: editTitle.trim(),
      description: editDescription.trim(),
      dueDate: editDueDate,
    };

    const updatedAssignmentsList = postedAssignments.map(asm => 
      asm.id === editingAssignment.id ? updatedAssignment : asm
    );
    setPostedAssignments(updatedAssignmentsList); // Update local state for UI
    
    // Update localStorage with the full list of all assignments
    const allAssignmentsData: Assignment[] = JSON.parse(localStorage.getItem(MOCK_ASSIGNMENTS_KEY) || '[]');
    const globallyUpdatedAssignments = allAssignmentsData.map(asm =>
      asm.id === editingAssignment.id ? updatedAssignment : asm
    );
    localStorage.setItem(MOCK_ASSIGNMENTS_KEY, JSON.stringify(globallyUpdatedAssignments));

    toast({ title: "Assignment Updated", description: `"${updatedAssignment.title}" has been updated.`});
    setIsEditDialogOpen(false);
    setEditingAssignment(null);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Posted Assignment History" 
        description="View and edit assignments you have posted." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ScrollText className="mr-2 h-5 w-5" /> Assignment Log</CardTitle>
          <CardDescription>Assignments you've created, sorted by newest due date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading assignment history...</p>
          ) : !currentTeacherId ? (
             <p className="text-destructive text-center py-4">Could not identify teacher. Please log in again.</p>
          ) : postedAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">You have not posted any assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ClipboardList className="inline-block mr-1 h-4 w-4"/>Title</TableHead>
                  <TableHead>Target Class</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Due Date</TableHead>
                  <TableHead><Info className="inline-block mr-1 h-4 w-4"/>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postedAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.title}</TableCell>
                    <TableCell>{getClassSectionName(assignment.classSectionId)}</TableCell>
                    <TableCell>{format(parseISO(assignment.dueDate), 'PP')}</TableCell>
                    <TableCell className="max-w-xs truncate">{assignment.description}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(assignment)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {postedAssignments.length > 0 && (
            <CardFooter>
                <p className="text-xs text-muted-foreground">This log helps you keep track of all assignments created. Use the edit button to update details.</p>
            </CardFooter>
        )}
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Assignment: {editingAssignment?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAssignment}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editTitle">Title</Label>
                <Input id="editTitle" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Textarea id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} required />
              </div>
              <div>
                <Label htmlFor="editDueDate">Due Date</Label>
                <Input id="editDueDate" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} required />
              </div>
              <div>
                 <Label>Target Class (Read-only)</Label>
                 <Input value={editingAssignment ? getClassSectionName(editingAssignment.classSectionId) : ''} readOnly disabled />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
