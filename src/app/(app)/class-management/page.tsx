
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
import type { ClassData, Student, Teacher, ClassNameRecord, SectionRecord, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save, Library, ListPlus, Layers, Combine, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; 
import { 
  addClassNameAction, deleteClassNameAction, 
  addSectionNameAction, deleteSectionNameAction,
  activateClassSectionAction, deleteActiveClassAction,
  assignStudentsToClassAction, assignTeacherToClassAction
} from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school or admin not linked:", error?.message || "No school record found for this admin_user_id.");
    return null;
  }
  return school.id;
}

export default function ClassManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [classNamesList, setClassNamesList] = useState<ClassNameRecord[]>([]);
  const [sectionNamesList, setSectionNamesList] = useState<SectionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [allStudentsInSchool, setAllStudentsInSchool] = useState<Student[]>([]); 
  const [allTeachersInSchool, setAllTeachersInSchool] = useState<Teacher[]>([]);
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>([]);

  const [isActivateClassSectionDialogOpen, setIsActivateClassSectionDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);

  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [newSectionNameInput, setNewSectionNameInput] = useState('');

  const [selectedClassNameIdForActivation, setSelectedClassNameIdForActivation] = useState<string>('');
  const [selectedSectionNameIdForActivation, setSelectedSectionNameIdForActivation] = useState<string>('');
  const [selectedAcademicYearIdForActivation, setSelectedAcademicYearIdForActivation] = useState<string | undefined>(undefined);
  
  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined | null>(undefined);


  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchAllData(schoolId);
        } else {
          setIsLoading(false);
          toast({ title: "Error", description: "Admin not linked to a school. Cannot manage classes.", variant: "destructive"});
        }
      });
    } else {
       setIsLoading(false);
       toast({ title: "Error", description: "Admin user ID not found. Please log in.", variant: "destructive"});
    }
  }, [toast]);

  async function fetchAllData(schoolId: string) {
    setIsLoading(true);
    await Promise.all([
      fetchClassNames(schoolId),
      fetchSectionNames(schoolId),
      fetchActiveClasses(schoolId),
      fetchStudents(schoolId),
      fetchTeachers(schoolId),
      fetchAcademicYears(schoolId),
    ]);
    setIsLoading(false);
  }

  async function fetchClassNames(schoolId: string) {
    const { data, error } = await supabase.from('class_names').select('*').eq('school_id', schoolId).order('name');
    if (error) toast({ title: "Error fetching class names", description: error.message, variant: "destructive" });
    else setClassNamesList(data || []);
  }
  async function fetchSectionNames(schoolId: string) {
    const { data, error } = await supabase.from('section_names').select('*').eq('school_id', schoolId).order('name');
    if (error) toast({ title: "Error fetching section names", description: error.message, variant: "destructive" });
    else setSectionNamesList(data || []);
  }
  async function fetchActiveClasses(schoolId: string) {
    const { data, error } = await supabase.from('classes').select('*').eq('school_id', schoolId).order('name').order('division');
    if (error) toast({ title: "Error fetching active classes", description: error.message, variant: "destructive" });
    else setActiveClasses( (data || []).map(ac => ({...ac, studentIds: []} as ClassData)) );
  }
   async function fetchStudents(schoolId: string) {
    const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId);
    if (error) toast({ title: "Error fetching students", description: error.message, variant: "destructive" });
    else setAllStudentsInSchool(data || []);
  }
  async function fetchTeachers(schoolId: string) {
    const { data, error } = await supabase.from('teachers').select('*').eq('school_id', schoolId);
    if (error) toast({ title: "Error fetching teachers", description: error.message, variant: "destructive" });
    else setAllTeachersInSchool(data || []);
  }
  async function fetchAcademicYears(schoolId: string) {
     const { data, error } = await supabase.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false });
    if (error) toast({ title: "Error fetching academic years", description: error.message, variant: "destructive" });
    else setAllAcademicYears(data || []);
  }

  const getTeacherName = (teacherId?: string | null): string => {
    if (!teacherId) return 'N/A';
    return allTeachersInSchool.find(t => t.id === teacherId)?.name || 'N/A';
  };
  const getAcademicYearName = (yearId?: string | null): string => {
    if (!yearId) return 'General'; 
    return allAcademicYears.find(ay => ay.id === yearId)?.name || 'N/A';
  };

  const handleAddClassName = async () => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await addClassNameAction(newClassNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      setNewClassNameInput('');
      fetchAllData(currentSchoolId); // Refresh all data
    }
    setIsSubmitting(false);
  };

  const handleDeleteClassName = async (id: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteClassNameAction(id, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) fetchAllData(currentSchoolId); // Refresh all data
    setIsSubmitting(false);
  };

  const handleAddSectionName = async () => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await addSectionNameAction(newSectionNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      setNewSectionNameInput('');
      fetchAllData(currentSchoolId); // Refresh all data
    }
    setIsSubmitting(false);
  };

  const handleDeleteSectionName = async (id: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteSectionNameAction(id, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) fetchAllData(currentSchoolId); // Refresh all data
    setIsSubmitting(false);
  };

  const handleOpenActivateDialog = () => {
    setSelectedClassNameIdForActivation('');
    setSelectedSectionNameIdForActivation('');
    setSelectedAcademicYearIdForActivation(undefined);
    setIsActivateClassSectionDialogOpen(true);
  };

  const handleActivateClassSection = async () => {
    if (!selectedClassNameIdForActivation || !selectedSectionNameIdForActivation || !currentSchoolId) {
      toast({ title: "Error", description: "Please select Class Name, Section Name, and ensure school context.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const className = classNamesList.find(cn => cn.id === selectedClassNameIdForActivation)?.name || '';
    const sectionName = sectionNamesList.find(sn => sn.id === selectedSectionNameIdForActivation)?.name || '';

    const result = await activateClassSectionAction({ 
      classNameId: selectedClassNameIdForActivation, 
      sectionNameId: selectedSectionNameIdForActivation, 
      schoolId: currentSchoolId,
      className, sectionName,
      academicYearId: selectedAcademicYearIdForActivation === 'none' ? undefined : selectedAcademicYearIdForActivation
    });
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      fetchAllData(currentSchoolId); // Refresh all data
      setIsActivateClassSectionDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDeleteActiveClass = async (activeClassId: string) => {
    if (!currentSchoolId) return;
    if (confirm(`Are you sure you want to delete this active class-section? This will unassign all students.`)) {
      setIsSubmitting(true);
      const result = await deleteActiveClassAction(activeClassId, currentSchoolId);
      toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
      if (result.ok) {
        fetchAllData(currentSchoolId); // Refresh all data
      }
      setIsSubmitting(false);
    }
  };

  const handleOpenManageStudentsDialog = (cls: ClassData) => {
    setClassToManageStudents(cls);
    const currentStudentIdsInClass = allStudentsInSchool.filter(s => s.class_id === cls.id).map(s => s.id);
    setSelectedStudentIdsForDialog(currentStudentIdsInClass);
    setIsManageStudentsDialogOpen(true);
  };

  const handleStudentSelectionChange = (studentId: string, checked: boolean) => {
    setSelectedStudentIdsForDialog(prev => 
      checked ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
  };

  const handleSaveStudentAssignments = async () => {
    if (!classToManageStudents || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await assignStudentsToClassAction(classToManageStudents.id, selectedStudentIdsForDialog, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      fetchAllData(currentSchoolId); // Refresh all data
      setIsManageStudentsDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleOpenAssignTeacherDialog = (cls: ClassData) => {
    setClassToAssignTeacher(cls);
    setSelectedTeacherIdForDialog(cls.teacher_id || undefined);
    setIsAssignTeacherDialogOpen(true);
  };

  const handleSaveTeacherAssignment = async () => {
    if (!classToAssignTeacher || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await assignTeacherToClassAction(classToAssignTeacher.id, selectedTeacherIdForDialog, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      fetchAllData(currentSchoolId); // Refresh all data
      setIsAssignTeacherDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  if (isLoading && !currentSchoolId) {
     return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading school data...</span></div>;
  }
  if (!currentSchoolId && !isLoading) {
    return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Class Management" />
        <Card><CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot manage classes.</CardContent></Card>
        </div>
    );
  }

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
                  disabled={isSubmitting}
                />
                <Button onClick={handleAddClassName} disabled={isSubmitting || !newClassNameInput.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Add Class Name
                </Button>
              </div>
              {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : classNamesList.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Class Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {classNamesList.map(cn => (
                      <TableRow key={cn.id}>
                        <TableCell>{cn.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteClassName(cn.id)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
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
                  disabled={isSubmitting}
                />
                <Button onClick={handleAddSectionName} disabled={isSubmitting || !newSectionNameInput.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Add Section Name
                </Button>
              </div>
              {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : sectionNamesList.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Section Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sectionNamesList.map(sn => (
                      <TableRow key={sn.id}>
                        <TableCell>{sn.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSectionName(sn.id)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
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
            <CardHeader className="sm:flex-row sm:justify-between sm:items-center">
              <div>
                <CardTitle>Activated Class-Sections</CardTitle>
                <CardDescription>Combine class names and section names to create assignable units. Students and teachers are assigned here.</CardDescription>
              </div>
              <Button onClick={handleOpenActivateDialog} className="mt-2 sm:mt-0" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> Activate New Class-Section</Button>
            </CardHeader>
            <CardContent>
             {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : activeClasses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Section/Division</TableHead>
                       <TableHead>Academic Year</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>No. of Students</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeClasses.map((cls) => {
                       const studentCount = allStudentsInSchool.filter(s => s.class_id === cls.id).length;
                       return (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.division}</TableCell>
                        <TableCell>{getAcademicYearName(cls.academic_year_id)}</TableCell>
                        <TableCell>{getTeacherName(cls.teacher_id)}</TableCell>
                        <TableCell>{studentCount}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenManageStudentsDialog(cls)} disabled={isSubmitting}><Users className="mr-1 h-3 w-3" /> Students</Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenAssignTeacherDialog(cls)} disabled={isSubmitting}><UserCog className="mr-1 h-3 w-3" /> Teacher</Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteActiveClass(cls.id)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              ) : <p className="text-center text-muted-foreground py-4">No class-sections activated yet. Activate one to assign students/teachers.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isActivateClassSectionDialogOpen} onOpenChange={setIsActivateClassSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate New Class-Section</DialogTitle>
            <CardDescription>Combine a Class Name with a Section Name to make it an active unit for assignments.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="selectClassNameForActivation">Select Class Name (Standard)</Label>
              <Select value={selectedClassNameIdForActivation} onValueChange={setSelectedClassNameIdForActivation} disabled={isSubmitting}>
                <SelectTrigger id="selectClassNameForActivation"><SelectValue placeholder="Choose a class name" /></SelectTrigger>
                <SelectContent>
                  {classNamesList.map(cn => (<SelectItem key={cn.id} value={cn.id}>{cn.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="selectSectionNameForActivation">Select Section/Division Name</Label>
              <Select value={selectedSectionNameIdForActivation} onValueChange={setSelectedSectionNameIdForActivation} disabled={isSubmitting}>
                <SelectTrigger id="selectSectionNameForActivation"><SelectValue placeholder="Choose a section name" /></SelectTrigger>
                <SelectContent>
                  {sectionNamesList.map(sn => (<SelectItem key={sn.id} value={sn.id}>{sn.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="selectAcademicYearForActivation">Academic Year (Optional)</Label>
              <Select value={selectedAcademicYearIdForActivation} onValueChange={(val) => setSelectedAcademicYearIdForActivation(val === 'none' ? undefined : val)} disabled={isSubmitting}>
                <SelectTrigger id="selectAcademicYearForActivation"><SelectValue placeholder="Select an academic year" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General)</SelectItem>
                  {allAcademicYears.map(ay => (<SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleActivateClassSection} disabled={isSubmitting || !selectedClassNameIdForActivation || !selectedSectionNameIdForActivation}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Combine className="mr-2 h-4 w-4" />} Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isManageStudentsDialogOpen} onOpenChange={(isOpen) => { setIsManageStudentsDialogOpen(isOpen); if (!isOpen) setClassToManageStudents(null); }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Students for {classToManageStudents?.name} - {classToManageStudents?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 overflow-y-auto flex-grow">
            <p className="text-sm text-muted-foreground">Select students to assign to this class-section. Only students not currently assigned to another active class-section (within the same school) are shown, plus those already in this one.</p>
            {allStudentsInSchool.filter(s => !s.class_id || s.class_id === classToManageStudents?.id).length > 0 ? 
                allStudentsInSchool.filter(s => !s.class_id || s.class_id === classToManageStudents?.id).map(student => (
              <div key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                <Checkbox 
                  id={`student-${student.id}`} 
                  checked={selectedStudentIdsForDialog.includes(student.id)}
                  onCheckedChange={(checked) => handleStudentSelectionChange(student.id, !!checked)}
                  disabled={isSubmitting}
                />
                <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer">
                  {student.name} <span className="text-xs text-muted-foreground">({student.email})</span>
                  {student.class_id && student.class_id !== classToManageStudents?.id && <span className="text-xs text-red-500 ml-2">(Assigned elsewhere)</span>}
                </Label>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No unassigned students available or all students are assigned elsewhere.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveStudentAssignments} disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignTeacherDialogOpen} onOpenChange={(isOpen) => { setIsAssignTeacherDialogOpen(isOpen); if (!isOpen) setClassToAssignTeacher(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {classToAssignTeacher?.name} - {classToAssignTeacher?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="teacherSelect">Select Teacher</Label>
              <Select value={selectedTeacherIdForDialog || undefined} onValueChange={(val) => setSelectedTeacherIdForDialog(val === 'unassign' ? null : val)} disabled={isSubmitting}>
                <SelectTrigger id="teacherSelect"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassign Teacher</SelectItem>
                  {allTeachersInSchool.map(teacher => (<SelectItem key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.subject})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
             {allTeachersInSchool.length === 0 && <p className="text-sm text-muted-foreground">No teachers available. Add teachers via Manage Teachers page.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveTeacherAssignment} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
