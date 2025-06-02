
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClassData, Student, Teacher, ClassNameRecord, SectionRecord } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save, Library, ListPlus, Layers, Combine } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_CLASS_NAMES_KEY = 'mockClassNamesData';
const MOCK_SECTION_NAMES_KEY = 'mockSectionNamesData';
const MOCK_CLASSES_KEY = 'mockClassesData'; // For activated class-sections
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_TEACHERS_KEY = 'mockTeachersData';

export default function ClassManagementPage() {
  const { toast } = useToast();

  const [classNamesList, setClassNamesList] = useState<ClassNameRecord[]>([]);
  const [sectionNamesList, setSectionNamesList] = useState<SectionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]); // Instantiated class-sections

  const [mockStudents, setMockStudents] = useState<Student[]>([]); 
  const [mockTeachers, setMockTeachers] = useState<Teacher[]>([]);

  // Dialog states
  const [isActivateClassSectionDialogOpen, setIsActivateClassSectionDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);

  // Form states for new class name / section name
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [newSectionNameInput, setNewSectionNameInput] = useState('');

  // States for "Activate Class-Section" Dialog
  const [selectedClassNameForActivation, setSelectedClassNameForActivation] = useState<string>('');
  const [selectedSectionNameForActivation, setSelectedSectionNameForActivation] = useState<string>('');
  
  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedClassNames = localStorage.getItem(MOCK_CLASS_NAMES_KEY);
      setClassNamesList(storedClassNames ? JSON.parse(storedClassNames) : []);
      
      const storedSectionNames = localStorage.getItem(MOCK_SECTION_NAMES_KEY);
      setSectionNamesList(storedSectionNames ? JSON.parse(storedSectionNames) : []);

      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setActiveClasses(storedActiveClasses ? JSON.parse(storedActiveClasses) : []);
      
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setMockStudents(storedStudents ? JSON.parse(storedStudents) : []);

      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      setMockTeachers(storedTeachers ? JSON.parse(storedTeachers) : []);
    }
  }, []);

  const updateLocalStorage = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const getTeacherName = (teacherId?: string) => mockTeachers.find(t => t.id === teacherId)?.name || 'N/A';

  // --- Class Name (Standard) Management ---
  const handleAddClassName = () => {
    if (!newClassNameInput.trim()) {
      toast({ title: "Error", description: "Class Name cannot be empty.", variant: "destructive" });
      return;
    }
    if (classNamesList.some(cn => cn.name.toLowerCase() === newClassNameInput.trim().toLowerCase())) {
      toast({ title: "Error", description: `Class Name '${newClassNameInput.trim()}' already exists.`, variant: "destructive" });
      return;
    }
    const newClassNameRecord: ClassNameRecord = { id: `cn-${Date.now()}`, name: newClassNameInput.trim() };
    const updatedList = [...classNamesList, newClassNameRecord];
    setClassNamesList(updatedList);
    updateLocalStorage(MOCK_CLASS_NAMES_KEY, updatedList);
    toast({ title: "Class Name Added", description: `'${newClassNameRecord.name}' has been added.` });
    setNewClassNameInput('');
  };

  const handleDeleteClassName = (id: string) => {
    const nameToDelete = classNamesList.find(cn => cn.id === id)?.name;
    // Optionally, check if this class name is used in any activeClasses and prevent deletion or warn.
    if (activeClasses.some(ac => ac.name === nameToDelete)) {
        toast({ title: "Cannot Delete", description: `Class Name '${nameToDelete}' is used in active class-sections. Please remove those first.`, variant: "destructive"});
        return;
    }
    if (confirm(`Are you sure you want to delete Class Name: ${nameToDelete}?`)) {
      const updatedList = classNamesList.filter(cn => cn.id !== id);
      setClassNamesList(updatedList);
      updateLocalStorage(MOCK_CLASS_NAMES_KEY, updatedList);
      toast({ title: "Class Name Deleted", description: `'${nameToDelete}' has been deleted.`, variant: "destructive" });
    }
  };

  // --- Section/Division Name Management ---
  const handleAddSectionName = () => {
    if (!newSectionNameInput.trim()) {
      toast({ title: "Error", description: "Section Name cannot be empty.", variant: "destructive" });
      return;
    }
     if (sectionNamesList.some(sn => sn.name.toLowerCase() === newSectionNameInput.trim().toLowerCase())) {
      toast({ title: "Error", description: `Section Name '${newSectionNameInput.trim()}' already exists.`, variant: "destructive" });
      return;
    }
    const newSectionNameRecord: SectionRecord = { id: `sn-${Date.now()}`, name: newSectionNameInput.trim() };
    const updatedList = [...sectionNamesList, newSectionNameRecord];
    setSectionNamesList(updatedList);
    updateLocalStorage(MOCK_SECTION_NAMES_KEY, updatedList);
    toast({ title: "Section Name Added", description: `'${newSectionNameRecord.name}' has been added.` });
    setNewSectionNameInput('');
  };

  const handleDeleteSectionName = (id: string) => {
    const nameToDelete = sectionNamesList.find(sn => sn.id === id)?.name;
     // Optionally, check if this section name is used in any activeClasses
    if (activeClasses.some(ac => ac.division === nameToDelete)) {
        toast({ title: "Cannot Delete", description: `Section Name '${nameToDelete}' is used in active class-sections. Please remove those first.`, variant: "destructive"});
        return;
    }
    if (confirm(`Are you sure you want to delete Section Name: ${nameToDelete}?`)) {
      const updatedList = sectionNamesList.filter(sn => sn.id !== id);
      setSectionNamesList(updatedList);
      updateLocalStorage(MOCK_SECTION_NAMES_KEY, updatedList);
      toast({ title: "Section Name Deleted", description: `'${nameToDelete}' has been deleted.`, variant: "destructive" });
    }
  };

  // --- Activate & Manage Class-Sections ---
  const handleOpenActivateDialog = () => {
    setSelectedClassNameForActivation('');
    setSelectedSectionNameForActivation('');
    setIsActivateClassSectionDialogOpen(true);
  };

  const handleActivateClassSection = () => {
    if (!selectedClassNameForActivation || !selectedSectionNameForActivation) {
      toast({ title: "Error", description: "Please select both a Class Name and a Section Name.", variant: "destructive" });
      return;
    }
    if (activeClasses.some(ac => ac.name === selectedClassNameForActivation && ac.division === selectedSectionNameForActivation)) {
      toast({ title: "Error", description: `Class-Section '${selectedClassNameForActivation} - ${selectedSectionNameForActivation}' is already active.`, variant: "destructive" });
      return;
    }
    const newActiveClass: ClassData = {
      id: `ac-${Date.now()}`,
      name: selectedClassNameForActivation,
      division: selectedSectionNameForActivation,
      studentIds: [],
    };
    const updatedActiveClasses = [...activeClasses, newActiveClass];
    setActiveClasses(updatedActiveClasses);
    updateLocalStorage(MOCK_CLASSES_KEY, updatedActiveClasses);
    toast({ title: "Class-Section Activated", description: `'${newActiveClass.name} - ${newActiveClass.division}' is now active.` });
    setIsActivateClassSectionDialogOpen(false);
  };

  const handleDeleteActiveClass = (activeClassId: string) => {
    const classToDelete = activeClasses.find(c => c.id === activeClassId);
    if (confirm(`Are you sure you want to delete active class-section ${classToDelete?.name} - ${classToDelete?.division}? This will unassign all students and teachers.`)) {
      const updatedActiveClasses = activeClasses.filter(c => c.id !== activeClassId);
      setActiveClasses(updatedActiveClasses);
      updateLocalStorage(MOCK_CLASSES_KEY, updatedActiveClasses);
      // Also, potentially update student records to remove this classId
      const updatedStudents = mockStudents.map(s => s.classId === activeClassId ? {...s, classId: ''} : s);
      setMockStudents(updatedStudents);
      updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

      toast({ title: "Active Class-Section Deleted", description: `Class ${classToDelete?.name} - ${classToDelete?.division} has been deactivated.`, variant: "destructive" });
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
    const updatedActiveClasses = activeClasses.map(c => 
      c.id === classToManageStudents.id ? { ...c, studentIds: selectedStudentIdsForDialog } : c
    );
    setActiveClasses(updatedActiveClasses);
    updateLocalStorage(MOCK_CLASSES_KEY, updatedActiveClasses);

    // Update student records with the new classId
    const studentsToUpdate = mockStudents.map(student => {
        if (selectedStudentIdsForDialog.includes(student.id)) { // Student is in this class
            return {...student, classId: classToManageStudents.id};
        } else if (student.classId === classToManageStudents.id) { // Student was in this class but now removed
            return {...student, classId: ''}; // Or some other logic for unassigned students
        }
        return student;
    });
    setMockStudents(studentsToUpdate);
    updateLocalStorage(MOCK_STUDENTS_KEY, studentsToUpdate);

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
    const updatedActiveClasses = activeClasses.map(c => 
      c.id === classToAssignTeacher.id ? { ...c, teacherId: newTeacherIdVal } : c
    );
    setActiveClasses(updatedActiveClasses);
    updateLocalStorage(MOCK_CLASSES_KEY, updatedActiveClasses);
    const teacherName = newTeacherIdVal ? getTeacherName(newTeacherIdVal) : 'No teacher';
    toast({ title: "Teacher Assigned", description: `${teacherName} assigned to ${classToAssignTeacher.name} - ${classToAssignTeacher.division}.` });
    setIsAssignTeacherDialogOpen(false);
    setClassToAssignTeacher(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class & Section Configuration" 
        description="Manage class names, section names, and activate class-sections for student/teacher assignment."
      />

      <Tabs defaultValue="manage-active-classes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manage-class-names"><Library className="mr-2 h-4 w-4" />Class Names</TabsTrigger>
          <TabsTrigger value="manage-section-names"><Layers className="mr-2 h-4 w-4" />Section Names</TabsTrigger>
          <TabsTrigger value="manage-active-classes"><Combine className="mr-2 h-4 w-4" />Activated Class-Sections</TabsTrigger>
        </TabsList>

        <TabsContent value="manage-class-names">
          <Card>
            <CardHeader>
              <CardTitle>Manage Class Names (Standards)</CardTitle>
              <CardDescription>Define the general class names or standards offered (e.g., Grade 1, Year 5).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input 
                  value={newClassNameInput} 
                  onChange={(e) => setNewClassNameInput(e.target.value)} 
                  placeholder="Enter new class name (e.g., Grade 10)" 
                  className="flex-grow"
                />
                <Button onClick={handleAddClassName}><PlusCircle className="mr-2 h-4 w-4" /> Add Class Name</Button>
              </div>
              {classNamesList.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Class Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {classNamesList.map(cn => (
                      <TableRow key={cn.id}>
                        <TableCell>{cn.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteClassName(cn.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-muted-foreground text-center py-4">No class names defined yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-section-names">
          <Card>
            <CardHeader>
              <CardTitle>Manage Section/Division Names</CardTitle>
              <CardDescription>Define the names for sections or divisions (e.g., A, Blue, Section Alpha).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input 
                  value={newSectionNameInput} 
                  onChange={(e) => setNewSectionNameInput(e.target.value)} 
                  placeholder="Enter new section name (e.g., Section A)"
                  className="flex-grow"
                />
                <Button onClick={handleAddSectionName}><PlusCircle className="mr-2 h-4 w-4" /> Add Section Name</Button>
              </div>
              {sectionNamesList.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Section Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sectionNamesList.map(sn => (
                      <TableRow key={sn.id}>
                        <TableCell>{sn.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSectionName(sn.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-muted-foreground text-center py-4">No section names defined yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-active-classes">
          <Card>
            <CardHeader className="flex-row justify-between items-center">
              <div>
                <CardTitle>Activated Class-Sections</CardTitle>
                <CardDescription>Combine class names and section names to create assignable units. Students and teachers are assigned here.</CardDescription>
              </div>
              <Button onClick={handleOpenActivateDialog}><PlusCircle className="mr-2 h-4 w-4" /> Activate New Class-Section</Button>
            </CardHeader>
            <CardContent>
              {activeClasses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Section/Division</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>No. of Students</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeClasses.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.division}</TableCell>
                        <TableCell>{getTeacherName(cls.teacherId)}</TableCell>
                        <TableCell>{cls.studentIds.length}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenManageStudentsDialog(cls)}><Users className="mr-1 h-3 w-3" /> Students</Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenAssignTeacherDialog(cls)}><UserCog className="mr-1 h-3 w-3" /> Teacher</Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteActiveClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center text-muted-foreground py-4">No class-sections activated yet. Activate one to assign students/teachers.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Activate New Class-Section Dialog */}
      <Dialog open={isActivateClassSectionDialogOpen} onOpenChange={setIsActivateClassSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate New Class-Section</DialogTitle>
            <CardDescription>Combine a Class Name with a Section Name to make it an active unit for assignments.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="selectClassNameForActivation">Select Class Name (Standard)</Label>
              <Select value={selectedClassNameForActivation} onValueChange={setSelectedClassNameForActivation}>
                <SelectTrigger id="selectClassNameForActivation"><SelectValue placeholder="Choose a class name" /></SelectTrigger>
                <SelectContent>
                  {classNamesList.length > 0 ? classNamesList.map(cn => (<SelectItem key={cn.id} value={cn.name}>{cn.name}</SelectItem>)) : <SelectItem value="-" disabled>No class names defined</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="selectSectionNameForActivation">Select Section/Division Name</Label>
              <Select value={selectedSectionNameForActivation} onValueChange={setSelectedSectionNameForActivation}>
                <SelectTrigger id="selectSectionNameForActivation"><SelectValue placeholder="Choose a section name" /></SelectTrigger>
                <SelectContent>
                  {sectionNamesList.length > 0 ? sectionNamesList.map(sn => (<SelectItem key={sn.id} value={sn.name}>{sn.name}</SelectItem>)) : <SelectItem value="-" disabled>No section names defined</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleActivateClassSection}><Combine className="mr-2 h-4 w-4" /> Activate</Button>
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
            <p className="text-sm text-muted-foreground">Select students to assign to this class-section. Only students not currently assigned to another active class-section are shown, plus those already in this one.</p>
            {mockStudents.filter(s => s.classId === '' || s.classId === classToManageStudents?.id).length > 0 ? 
                mockStudents.filter(s => s.classId === '' || s.classId === classToManageStudents?.id).map(student => (
              <div key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                <Checkbox 
                  id={`student-${student.id}`} 
                  checked={selectedStudentIdsForDialog.includes(student.id)}
                  onCheckedChange={(checked) => handleStudentSelectionChange(student.id, !!checked)}
                />
                <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer">
                  {student.name} <span className="text-xs text-muted-foreground">({student.email})</span>
                  {student.classId && student.classId !== classToManageStudents?.id && <span className="text-xs text-red-500 ml-2">(Assigned elsewhere)</span>}
                </Label>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No unassigned students available or all students are assigned elsewhere. Add students via Admissions or check their current assignments.</p>}
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
                <SelectTrigger id="teacherSelect"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassign Teacher</SelectItem>
                  {mockTeachers.map(teacher => (<SelectItem key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.subject})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
             {mockTeachers.length === 0 && <p className="text-sm text-muted-foreground">No teachers available. Add teachers via Manage Teachers page.</p>}
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
