
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
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save, Library, ListPlus } from 'lucide-react';
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
  const [isAddClassAndSectionDialogOpen, setIsAddClassAndSectionDialogOpen] = useState(false);
  const [isAddSectionToClassDialogOpen, setIsAddSectionToClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);

  // Form states
  const [currentClass, setCurrentClass] = useState<Partial<ClassData>>({}); // For edit dialog

  // States for "Add New Class & Initial Section" Dialog
  const [newClassName, setNewClassName] = useState('');
  const [initialSectionName, setInitialSectionName] = useState('');

  // States for "Add Section to Existing Class" Dialog
  const [selectedClassForNewSection, setSelectedClassForNewSection] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');


  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const loadedClasses = storedClasses ? JSON.parse(storedClasses) : initialClassesData;
      setClasses(loadedClasses);
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

  const availableClassNamesForNewSection = useMemo(() => {
    return [...new Set(classes.map(cls => cls.name))].sort();
  }, [classes]);

  const handleOpenAddClassAndSectionDialog = () => {
    setNewClassName('');
    setInitialSectionName('');
    setIsAddClassAndSectionDialogOpen(true);
  };

  const handleCreateClassAndInitialSection = () => {
    if (!newClassName || !initialSectionName) {
      toast({ title: "Error", description: "Class Name and Initial Section Name are required.", variant: "destructive" });
      return;
    }
    if (classes.some(c => c.name === newClassName && c.division === initialSectionName)) {
      toast({ title: "Error", description: `The section '${initialSectionName}' already exists for class '${newClassName}'.`, variant: "destructive" });
      return;
    }
    const newClassEntry: ClassData = {
      id: `c-${Date.now()}`,
      name: newClassName,
      division: initialSectionName,
      studentIds: [],
    };
    const updatedClasses = [...classes, newClassEntry];
    updateLocalStorageAndState(updatedClasses);
    toast({ title: "Class Created", description: `Class '${newClassName}' with section '${initialSectionName}' has been created.` });
    setIsAddClassAndSectionDialogOpen(false);
  };
  
  const handleOpenAddSectionToClassDialog = () => {
    setSelectedClassForNewSection('');
    setNewSectionName('');
    setIsAddSectionToClassDialogOpen(true);
  };

  const handleAddSectionToExistingClass = () => {
    if (!selectedClassForNewSection || !newSectionName) {
      toast({ title: "Error", description: "Please select a class and provide a new section name.", variant: "destructive" });
      return;
    }
    if (classes.some(c => c.name === selectedClassForNewSection && c.division === newSectionName)) {
      toast({ title: "Error", description: `The section '${newSectionName}' already exists for class '${selectedClassForNewSection}'.`, variant: "destructive" });
      return;
    }
    const newSectionEntry: ClassData = {
      id: `c-${Date.now()}`,
      name: selectedClassForNewSection,
      division: newSectionName,
      studentIds: [],
    };
    const updatedClasses = [...classes, newSectionEntry];
    updateLocalStorageAndState(updatedClasses);
    toast({ title: "Section Added", description: `Section '${newSectionName}' has been added to class '${selectedClassForNewSection}'.` });
    setIsAddSectionToClassDialogOpen(false);
  };


  const handleOpenEditClassDialog = (cls: ClassData) => {
    setCurrentClass({...cls});
    setIsEditClassDialogOpen(true);
  };

  const handleUpdateClass = () => {
    if (!currentClass.id || !currentClass.name || !currentClass.division) {
      toast({ title: "Error", description: "Invalid class data for update.", variant: "destructive" });
      return;
    }
    if (classes.some(c => c.id !== currentClass.id && c.name === currentClass.name && c.division === currentClass.division)) {
       toast({ title: "Error", description: `Another class with name '${currentClass.name}' and section '${currentClass.division}' already exists.`, variant: "destructive" });
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
        title="Class & Section Management" 
        description="Create classes, add sections, and assign students/teachers."
        actions={
          <div className="flex gap-2">
            <Button onClick={handleOpenAddClassAndSectionDialog}><Library className="mr-2 h-4 w-4" /> Add Class & Initial Section</Button>
            <Button onClick={handleOpenAddSectionToClassDialog}><ListPlus className="mr-2 h-4 w-4" /> Add Section to Class</Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Class & Section List</CardTitle>
          <CardDescription>Overview of all classes and their sections.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Section / Division</TableHead>
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
            <p className="text-center text-muted-foreground py-4">No classes created yet. Use the buttons above to add them.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Add New Class & Initial Section Dialog */}
      <Dialog open={isAddClassAndSectionDialogOpen} onOpenChange={(isOpen) => { 
          setIsAddClassAndSectionDialogOpen(isOpen); 
          if (!isOpen) { setNewClassName(''); setInitialSectionName(''); } 
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class & Initial Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="newClassNameDialog">New Class Name</Label>
              <Input 
                id="newClassNameDialog" 
                value={newClassName} 
                onChange={(e) => setNewClassName(e.target.value)} 
                placeholder="e.g., Grade 10, Year 1" 
              />
            </div>
            <div>
              <Label htmlFor="initialSectionNameDialog">Initial Section Name</Label>
              <Input 
                id="initialSectionNameDialog" 
                value={initialSectionName} 
                onChange={(e) => setInitialSectionName(e.target.value)} 
                placeholder="e.g., A, Blue House" 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreateClassAndInitialSection}><Save className="mr-2 h-4 w-4" /> Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Add Section to Existing Class Dialog */}
      <Dialog open={isAddSectionToClassDialogOpen} onOpenChange={(isOpen) => { 
          setIsAddSectionToClassDialogOpen(isOpen); 
          if (!isOpen) { setSelectedClassForNewSection(''); setNewSectionName(''); } 
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section to Existing Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="selectExistingClass">Select Class Name</Label>
              <Select value={selectedClassForNewSection} onValueChange={(val) => setSelectedClassForNewSection(val)}>
                <SelectTrigger id="selectExistingClass">
                  <SelectValue placeholder="Select an existing class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClassNamesForNewSection.map(name => ( 
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                   {availableClassNamesForNewSection.length === 0 && <SelectItem value="no-class" disabled>No classes defined yet</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newSectionNameDialog">New Section Name</Label>
              <Input 
                id="newSectionNameDialog" 
                value={newSectionName} 
                onChange={(e) => setNewSectionName(e.target.value)} 
                placeholder="e.g., B, Red House" 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleAddSectionToExistingClass}><Save className="mr-2 h-4 w-4" /> Add Section</Button>
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
              <Label htmlFor="editClassDivision">Section / Division</Label>
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


    