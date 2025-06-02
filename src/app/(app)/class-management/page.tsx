
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
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_TEACHERS_KEY = 'mockTeachersData';

// Initial mock data if localStorage is empty
const initialMockTeachers: Teacher[] = [
    { id: 't1', name: 'Mr. John Smith', email: 'jsmith@example.com', subject: 'Math', profilePictureUrl: 'https://placehold.co/40x40.png?text=JS' },
    { id: 't2', name: 'Ms. Emily Jones', email: 'ejones@example.com', subject: 'Science', profilePictureUrl: 'https://placehold.co/40x40.png?text=EJ' },
    { id: 't3', name: 'Dr. Alan Who', email: 'awho@example.com', subject: 'History', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
];
const initialMockStudents: Student[] = [
    { id: 's1', name: 'Alice Wonderland', email: 'a@example.com', classId: 'c1', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
    { id: 's2', name: 'Bob The Builder', email: 'b@example.com', classId: 'c1', profilePictureUrl: 'https://placehold.co/40x40.png?text=BB' },
    { id: 's3', name: 'Charlie Brown', email: 'c@example.com', classId: 'c2', profilePictureUrl: 'https://placehold.co/40x40.png?text=CB' },
];
const initialClassesData: ClassData[] = [
  { id: 'c1', name: 'Grade 10', division: 'A', teacherId: 't1', studentIds: ['s1', 's2'] },
  { id: 'c2', name: 'Grade 10', division: 'B', teacherId: 't2', studentIds: ['s3'] },
  { id: 'c3', name: 'Grade 11', division: 'A', teacherId: 't3', studentIds: [] },
];


export default function ClassManagementPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [mockStudents, setMockStudents] = useState<Student[]>([]); 
  const [mockTeachers, setMockTeachers] = useState<Teacher[]>([]);

  // Dialog states
  const [isCreateClassDialogOpen, setIsCreateClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);

  // Form states
  const [currentClass, setCurrentClass] = useState<Partial<ClassData>>({}); // For edit dialog
  const [newClassName, setNewClassName] = useState(''); // For create dialog
  const [newClassDivision, setNewClassDivision] = useState(''); // For create dialog

  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setClasses(storedClasses ? JSON.parse(storedClasses) : initialClassesData);
      if (!storedClasses) localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify(initialClassesData));
      
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setMockStudents(storedStudents ? JSON.parse(storedStudents) : initialMockStudents);
      if (!storedStudents) localStorage.setItem(MOCK_STUDENTS_KEY, JSON.stringify(initialMockStudents));

      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      setMockTeachers(storedTeachers ? JSON.parse(storedTeachers) : initialMockTeachers);
      if (!storedTeachers) localStorage.setItem(MOCK_TEACHERS_KEY, JSON.stringify(initialMockTeachers));
    }
  }, []);

  const updateLocalStorageAndState = (updatedClasses: ClassData[]) => {
    setClasses(updatedClasses);
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify(updatedClasses));
    }
  };

  const getTeacherName = (teacherId?: string) => mockTeachers.find(t => t.id === teacherId)?.name || 'N/A';

  const handleOpenCreateClassDialog = () => {
    setNewClassName('');
    setNewClassDivision('');
    setIsCreateClassDialogOpen(true);
  };

  const handleCreateClass = () => {
    if (!newClassName || !newClassDivision) {
      toast({ title: "Error", description: "Class Name and Division are required.", variant: "destructive" });
      return;
    }
    const newClass: ClassData = {
      id: `c${Date.now()}`,
      name: newClassName,
      division: newClassDivision,
      studentIds: [],
    };
    const updatedClasses = [...classes, newClass];
    updateLocalStorageAndState(updatedClasses);
    toast({ title: "Class Created", description: `${newClass.name} - ${newClass.division} has been created.` });
    setIsCreateClassDialogOpen(false);
    setNewClassName('');
    setNewClassDivision('');
  };

  const handleOpenEditClassDialog = (cls: ClassData) => {
    setCurrentClass({...cls}); // Use currentClass state for editing
    setIsEditClassDialogOpen(true);
  };

  const handleUpdateClass = () => {
    if (!currentClass.id || !currentClass.name || !currentClass.division) {
      toast({ title: "Error", description: "Invalid class data for update.", variant: "destructive" });
      return;
    }
    const updatedClasses = classes.map(c => 
        c.id === currentClass.id ? { ...c, name: currentClass.name!, division: currentClass.division! } : c
    );
    updateLocalStorageAndState(updatedClasses);
    toast({ title: "Class Updated", description: `${currentClass.name} - ${currentClass.division} has been updated.` });
    setIsEditClassDialogOpen(false);
    setCurrentClass({});
  };
  
  const handleDeleteClass = (classId: string) => { 
    const classToDelete = classes.find(c => c.id === classId);
    if (confirm(`Are you sure you want to delete class ${classToDelete?.name} - ${classToDelete?.division}? This action cannot be undone.`)) {
      const updatedClasses = classes.filter(c => c.id !== classId);
      updateLocalStorageAndState(updatedClasses);
      toast({ title: "Class Deleted", description: `Class ${classToDelete?.name} - ${classToDelete?.division} has been deleted.`, variant: "destructive" });
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
    const updatedClasses = classes.map(c => 
      c.id === classToManageStudents.id ? { ...c, studentIds: selectedStudentIdsForDialog } : c
    );
    updateLocalStorageAndState(updatedClasses);
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
    const newTeacherIdVal = selectedTeacherIdForDialog === 'unassign' ? undefined : selectedTeacherIdForDialog;
    const updatedClasses = classes.map(c => 
      c.id === classToAssignTeacher.id ? { ...c, teacherId: newTeacherIdVal } : c
    );
    updateLocalStorageAndState(updatedClasses);
    const teacherName = newTeacherIdVal ? getTeacherName(newTeacherIdVal) : 'No teacher';
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
            <p className="text-center text-muted-foreground py-4">No classes created yet. Use "Create New Class" to add one.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Create Class Dialog */}
      <Dialog open={isCreateClassDialogOpen} onOpenChange={(isOpen) => { 
          setIsCreateClassDialogOpen(isOpen); 
          if (!isOpen) { setNewClassName(''); setNewClassDivision(''); } 
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newClassNameDialog">Class Name</Label>
              <Input 
                id="newClassNameDialog" 
                value={newClassName} 
                onChange={(e) => setNewClassName(e.target.value)} 
                placeholder="e.g., Grade 10, Year 1" 
              />
            </div>
            <div>
              <Label htmlFor="newClassDivisionDialog">Division / Section</Label>
              <Input 
                id="newClassDivisionDialog" 
                value={newClassDivision} 
                onChange={(e) => setNewClassDivision(e.target.value)} 
                placeholder="e.g., A, Blue House" 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreateClass}><Save className="mr-2 h-4 w-4" /> Create Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog - uses currentClass state */}
      <Dialog open={isEditClassDialogOpen} onOpenChange={(isOpen) => { setIsEditClassDialogOpen(isOpen); if (!isOpen) setCurrentClass({}); }}>
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
      <Dialog open={isManageStudentsDialogOpen} onOpenChange={(isOpen) => { setIsManageStudentsDialogOpen(isOpen); if (!isOpen) setClassToManageStudents(null); }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Students for {classToManageStudents?.name} - {classToManageStudents?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 overflow-y-auto flex-grow">
            <p className="text-sm text-muted-foreground">Select students to assign to this class. Students are managed via the Admissions and Manage Students pages.</p>
            {mockStudents.length > 0 ? mockStudents.map(student => (
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
            )) : <p className="text-sm text-muted-foreground text-center py-4">No students available in the system. Add students via Admissions.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSaveStudentAssignments}><Save className="mr-2 h-4 w-4" /> Save Assignments</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={isAssignTeacherDialogOpen} onOpenChange={(isOpen) => { setIsAssignTeacherDialogOpen(isOpen); if (!isOpen) setClassToAssignTeacher(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {classToAssignTeacher?.name} - {classToAssignTeacher?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="teacherSelect">Select Teacher</Label>
              <Select value={selectedTeacherIdForDialog} onValueChange={(val) => setSelectedTeacherIdForDialog(val === 'unassign' ? undefined : val)}>
                <SelectTrigger id="teacherSelect">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassign Teacher</SelectItem>
                  {mockTeachers.map(teacher => ( 
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.subject})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             {mockTeachers.length === 0 && <p className="text-sm text-muted-foreground">No teachers available to assign. Add teachers via Manage Teachers page.</p>}
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
