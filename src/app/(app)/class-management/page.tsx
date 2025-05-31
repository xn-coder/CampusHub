
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClassData, Student, Teacher } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Mock data - In a real app, this would come from a data store or API
const initialMockTeachers: Teacher[] = [
    { id: 't1', name: 'Mr. John Smith', email: 'smith@example.com', subject: 'Math', profilePictureUrl: 'https://placehold.co/40x40.png?text=JS' },
    { id: 't2', name: 'Ms. Emily Jones', email: 'jones@example.com', subject: 'Science', profilePictureUrl: 'https://placehold.co/40x40.png?text=EJ' },
    { id: 't3', name: 'Dr. Alan Who', email: 'who@example.com', subject: 'History', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
];
const initialMockStudents: Student[] = [
    { id: 's1', name: 'Alice Wonderland', email: 'a@example.com', classId: '10A', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
    { id: 's2', name: 'Bob The Builder', email: 'b@example.com', classId: '10A', profilePictureUrl: 'https://placehold.co/40x40.png?text=BB' },
    { id: 's3', name: 'Charlie Brown', email: 'c@example.com', classId: '10B', profilePictureUrl: 'https://placehold.co/40x40.png?text=CB' },
    { id: 's4', name: 'Diana Prince', email: 'd@example.com', classId: '10B', profilePictureUrl: 'https://placehold.co/40x40.png?text=DP' },
    { id: 's5', name: 'Eve Harrington', email: 'e@example.com', classId: '11A', profilePictureUrl: 'https://placehold.co/40x40.png?text=EH' },
];

const initialClasses: ClassData[] = [
  { id: 'c1', name: 'Grade 10', division: 'A', teacherId: 't1', studentIds: ['s1', 's2'] },
  { id: 'c2', name: 'Grade 10', division: 'B', teacherId: 't2', studentIds: ['s3'] },
  { id: 'c3', name: 'Grade 11', division: 'A', teacherId: 't3', studentIds: ['s4', 's5'] },
];


export default function ClassManagementPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassData[]>(initialClasses);
  const [mockStudents, setMockStudents] = useState<Student[]>(initialMockStudents); // Using local mock for dialogs
  const [mockTeachers, setMockTeachers] = useState<Teacher[]>(initialMockTeachers); // Using local mock for dialogs

  // Dialog states
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);

  // Form states
  const [currentClass, setCurrentClass] = useState<Partial<ClassData>>({}); // For create/edit
  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined>(undefined);


  const getTeacherName = (teacherId?: string) => mockTeachers.find(t => t.id === teacherId)?.name || 'N/A';

  const handleOpenCreateClassDialog = () => {
    setCurrentClass({ name: '', division: '' });
    setIsCreateClassDialogOpen(true);
  };

  const handleCreateClass = () => {
    if (!currentClass.name || !currentClass.division) {
      toast({ title: "Error", description: "Class Name and Division are required.", variant: "destructive" });
      return;
    }
    const newClass: ClassData = {
      id: `c${Date.now()}`,
      name: currentClass.name,
      division: currentClass.division,
      studentIds: [],
    };
    setClasses(prev => [...prev, newClass]);
    toast({ title: "Class Created", description: `${newClass.name} - ${newClass.division} has been created.` });
    setIsCreateClassDialogOpen(false);
  };

  const handleOpenEditClassDialog = (cls: ClassData) => {
    setCurrentClass({...cls});
    setIsEditClassDialogOpen(true);
  };

  const handleUpdateClass = () => {
    if (!currentClass.id || !currentClass.name || !currentClass.division) {
      toast({ title: "Error", description: "Invalid class data.", variant: "destructive" });
      return;
    }
    setClasses(prev => prev.map(c => c.id === currentClass.id ? { ...c, name: currentClass.name!, division: currentClass.division! } : c));
    toast({ title: "Class Updated", description: `${currentClass.name} - ${currentClass.division} has been updated.` });
    setIsEditClassDialogOpen(false);
  };
  
  const handleDeleteClass = (classId: string) => { 
    if (confirm(`Are you sure you want to delete class ${classes.find(c=>c.id === classId)?.name}? This action cannot be undone.`)) {
      setClasses(prev => prev.filter(c => c.id !== classId)); 
      toast({ title: "Class Deleted", description: `Class ${classId} has been deleted.`, variant: "destructive" });
    }
  };

  const handleOpenManageStudentsDialog = (cls: ClassData) => {
    setClassToManageStudents(cls);
    setSelectedStudentIdsForDialog([...cls.studentIds]);
    setIsManageStudentsDialogOpen(true);
  };

  const handleStudentSelectionChange = (studentId: string, checked: boolean) => {
    setSelectedStudentIdsForDialog(prev => 
      checked ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
  };

  const handleSaveStudentAssignments = () => {
    if (!classToManageStudents) return;
    setClasses(prev => prev.map(c => 
      c.id === classToManageStudents.id ? { ...c, studentIds: selectedStudentIdsForDialog } : c
    ));
    toast({ title: "Students Updated", description: `Student assignments for ${classToManageStudents.name} - ${classToManageStudents.division} updated.` });
    setIsManageStudentsDialogOpen(false);
    setClassToManageStudents(null);
  };

  const handleOpenAssignTeacherDialog = (cls: ClassData) => {
    setClassToAssignTeacher(cls);
    setSelectedTeacherIdForDialog(cls.teacherId);
    setIsAssignTeacherDialogOpen(true);
  };

  const handleSaveTeacherAssignment = () => {
    if (!classToAssignTeacher) return;
    const newTeacherId = selectedTeacherIdForDialog === 'unassign' ? undefined : selectedTeacherIdForDialog;
    setClasses(prev => prev.map(c => 
      c.id === classToAssignTeacher.id ? { ...c, teacherId: newTeacherId } : c
    ));
    const teacherName = getTeacherName(newTeacherId);
    toast({ title: "Teacher Assigned", description: `${teacherName} assigned to ${classToAssignTeacher.name} - ${classToAssignTeacher.division}.` });
    setIsAssignTeacherDialogOpen(false);
    setClassToAssignTeacher(null);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class & Division Management" 
        description="Create and manage classes, divisions, and assign students/teachers."
        actions={
            <Button onClick={handleOpenCreateClassDialog}><PlusCircle className="mr-2 h-4 w-4" /> Create New Class</Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Class List</CardTitle>
          <CardDescription>Overview of all classes and divisions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>No. of Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.division}</TableCell>
                  <TableCell>{getTeacherName(cls.teacherId)}</TableCell>
                  <TableCell>{cls.studentIds.length}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditClassDialog(cls)}><Edit2 className="mr-1 h-3 w-3" /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenManageStudentsDialog(cls)}><Users className="mr-1 h-3 w-3" /> Students</Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenAssignTeacherDialog(cls)}><UserCog className="mr-1 h-3 w-3" /> Teacher</Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {classes.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No classes created yet.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Create Class Dialog */}
      <Dialog open={isCreateClassDialogOpen} onOpenChange={setIsCreateClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newClassName">Class Name</Label>
              <Input id="newClassName" value={currentClass.name || ''} onChange={(e) => setCurrentClass(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., Grade 10, Year 1" />
            </div>
            <div>
              <Label htmlFor="newClassDivision">Division / Section</Label>
              <Input id="newClassDivision" value={currentClass.division || ''} onChange={(e) => setCurrentClass(prev => ({ ...prev, division: e.target.value }))} placeholder="e.g., A, Blue House" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreateClass}><Save className="mr-2 h-4 w-4" /> Create Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={isEditClassDialogOpen} onOpenChange={setIsEditClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class: {currentClass.name} - {currentClass.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editClassName">Class Name</Label>
              <Input id="editClassName" value={currentClass.name || ''} onChange={(e) => setCurrentClass(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="editClassDivision">Division / Section</Label>
              <Input id="editClassDivision" value={currentClass.division || ''} onChange={(e) => setCurrentClass(prev => ({ ...prev, division: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdateClass}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog open={isManageStudentsDialogOpen} onOpenChange={setIsManageStudentsDialogOpen}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Students for {classToManageStudents?.name} - {classToManageStudents?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 overflow-y-auto flex-grow">
            <p className="text-sm text-muted-foreground">Select students to assign to this class.</p>
            {mockStudents.map(student => ( // Using local mockStudents for dialog
              <div key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                <Checkbox 
                  id={`student-${student.id}`} 
                  checked={selectedStudentIdsForDialog.includes(student.id)}
                  onCheckedChange={(checked) => handleStudentSelectionChange(student.id, !!checked)}
                />
                <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer">
                  {student.name} <span className="text-xs text-muted-foreground">({student.email})</span>
                </Label>
              </div>
            ))}
             {mockStudents.length === 0 && <p className="text-sm text-muted-foreground">No students available to assign.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveStudentAssignments}><Save className="mr-2 h-4 w-4" /> Save Assignments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={isAssignTeacherDialogOpen} onOpenChange={setIsAssignTeacherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {classToAssignTeacher?.name} - {classToAssignTeacher?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="teacherSelect">Select Teacher</Label>
              <Select value={selectedTeacherIdForDialog} onValueChange={setSelectedTeacherIdForDialog}>
                <SelectTrigger id="teacherSelect">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassign Teacher</SelectItem>
                  {mockTeachers.map(teacher => ( // Using local mockTeachers for dialog
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.subject})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             {mockTeachers.length === 0 && <p className="text-sm text-muted-foreground">No teachers available to assign.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveTeacherAssignment}><Save className="mr-2 h-4 w-4" /> Assign Teacher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

        