
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
import type { ClassData, Student, Teacher, ClassNameRecord, SectionRecord, AcademicYear, Subject } from '@/types';
import { useState, useEffect, type FormEvent, useMemo, useCallback } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog, Save, Library, ListPlus, Layers, Combine, Loader2, ArrowRight, MoreHorizontal, ChevronLeft, ChevronRight, BookOpenText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import {
  addClassNameAction, updateClassNameAction, deleteClassNameAction,
  addSectionNameAction, updateSectionNameAction, deleteSectionNameAction,
  activateClassSectionAction, deleteActiveClassAction,
  assignStudentsToClassAction, assignTeacherToClassAction,
  getClassNamesAction, getSectionNamesAction, getActiveClassesAction,
  promoteStudentsToNewClassAction,
  getStudentsWithStatusForPromotionAction,
  getAssignedSubjectsForClassAction,
  saveClassSubjectAssignmentsAction,
} from './actions';
import { getAdminSchoolIdAction, getAcademicYearsForSchoolAction } from '../admin/academic-years/actions';
import { Badge } from '@/components/ui/badge';

const ITEMS_PER_PAGE = 10;

type PromotionStatus = 'Pass' | 'Fail' | 'Incomplete';
type StudentWithStatus = Student & { promotionStatus: PromotionStatus };

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
  const [allSubjectsInSchool, setAllSubjectsInSchool] = useState<Subject[]>([]);
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog states
  const [isActivateClassSectionDialogOpen, setIsActivateClassSectionDialogOpen] = useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] = useState(false);
  const [isAssignTeacherDialogOpen, setIsAssignTeacherDialogOpen] = useState(false);
  const [isAssignSubjectsDialogOpen, setIsAssignSubjectsDialogOpen] = useState(false);
  const [isEditClassNameDialogOpen, setIsEditClassNameDialogOpen] = useState(false);
  const [isEditSectionNameDialogOpen, setIsEditSectionNameDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);


  // Form input states
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [newSectionNameInput, setNewSectionNameInput] = useState('');
  const [editNameInput, setEditNameInput] = useState('');

  // Dialog-specific states
  const [editingClassNameRecord, setEditingClassNameRecord] = useState<ClassNameRecord | null>(null);
  const [editingSectionNameRecord, setEditingSectionNameRecord] = useState<SectionRecord | null>(null);
  const [selectedClassNameIdForActivation, setSelectedClassNameIdForActivation] = useState<string>('');
  const [selectedSectionNameIdForActivation, setSelectedSectionNameIdForActivation] = useState<string>('');
  const [selectedAcademicYearIdForActivation, setSelectedAcademicYearIdForActivation] = useState<string | undefined>(undefined);
  const [classToManageStudents, setClassToManageStudents] = useState<ClassData | null>(null);
  const [selectedStudentIdsForDialog, setSelectedStudentIdsForDialog] = useState<string[]>([]);
  const [classToAssignTeacher, setClassToAssignTeacher] = useState<ClassData | null>(null);
  const [selectedTeacherIdForDialog, setSelectedTeacherIdForDialog] = useState<string | undefined | null>(undefined);
  const [classToAssignSubjects, setClassToAssignSubjects] = useState<ClassData | null>(null);
  const [selectedSubjectIdsForDialog, setSelectedSubjectIdsForDialog] = useState<string[]>([]);

  // Promotion Dialog State
  const [classToPromote, setClassToPromote] = useState<ClassData | null>(null);
  const [destinationClassId, setDestinationClassId] = useState<string>('');
  const [studentsForPromotion, setStudentsForPromotion] = useState<StudentWithStatus[]>([]);
  const [selectedStudentsForPromotion, setSelectedStudentsForPromotion] = useState<string[]>([]);
  const [promotionFilter, setPromotionFilter] = useState<PromotionStatus | 'all'>('all');
  const [isFetchingPromotionData, setIsFetchingPromotionData] = useState(false);


  const fetchAllData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    try {
        const [
            classNamesResult,
            sectionNamesResult,
            activeClassesResult,
            studentsResult,
            teachersResult,
            academicYearsResult,
            subjectsResult
        ] = await Promise.all([
          getClassNamesAction(schoolId),
          getSectionNamesAction(schoolId),
          getActiveClassesAction(schoolId),
          supabase.from('students').select('*').eq('school_id', schoolId),
          supabase.from('teachers').select('*').eq('school_id', schoolId),
          getAcademicYearsForSchoolAction(schoolId), // Using server action
          supabase.from('subjects').select('*').eq('school_id', schoolId).order('name'),
        ]);

        if (classNamesResult.ok && classNamesResult.classNames) setClassNamesList(classNamesResult.classNames);
        else toast({ title: "Error fetching class names", description: classNamesResult.message || "Unknown error", variant: "destructive" });

        if (sectionNamesResult.ok && sectionNamesResult.sectionNames) setSectionNamesList(sectionNamesResult.sectionNames);
        else toast({ title: "Error fetching section names", description: sectionNamesResult.message || "Unknown error", variant: "destructive" });

        if (activeClassesResult.ok && activeClassesResult.activeClasses) setActiveClasses(activeClassesResult.activeClasses);
        else toast({ title: "Error fetching active classes", description: activeClassesResult.message || "Unknown error", variant: "destructive" });

        if (studentsResult.error) toast({ title: "Error fetching students", description: studentsResult.error.message, variant: "destructive" });
        else setAllStudentsInSchool(studentsResult.data || []);

        if (teachersResult.error) toast({ title: "Error fetching teachers", description: teachersResult.error.message, variant: "destructive" });
        else setAllTeachersInSchool(teachersResult.data || []);

        if (subjectsResult.error) toast({ title: "Error fetching subjects", description: subjectsResult.error.message, variant: "destructive" });
        else setAllSubjectsInSchool(subjectsResult.data || []);

        if (academicYearsResult.ok && academicYearsResult.years) setAllAcademicYears(academicYearsResult.years);
        else toast({ title: "Error fetching academic years", description: academicYearsResult.message || "Unknown error", variant: "destructive" });

    } catch (err: any) {
        console.error("Error in fetchAllData Promise.all:", err);
        toast({ title: "Data Fetch Error", description: err.message || "An unexpected error occurred while fetching page data.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paginatedActiveClasses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeClasses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [activeClasses, currentPage]);

  const totalPages = Math.ceil(activeClasses.length / ITEMS_PER_PAGE);


  useEffect(() => {
    const adminIdFromStorage = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminIdFromStorage);

    if (adminIdFromStorage) {
      getAdminSchoolIdAction(adminIdFromStorage).then(fetchedSchoolId => {
        setCurrentSchoolId(fetchedSchoolId);
        if (!fetchedSchoolId) {
          setIsLoading(false);
          toast({ title: "School Not Found", description: "Admin not linked to a school. Cannot manage classes.", variant: "destructive"});
        }
      });
    } else {
       setIsLoading(false);
       toast({ title: "Authentication Error", description: "Admin user ID not found. Please log in.", variant: "destructive"});
    }
  }, [toast]);

  useEffect(() => {
    if (currentSchoolId) {
        fetchAllData(currentSchoolId);
    }
  }, [currentSchoolId, fetchAllData]);


  const getTeacherName = (teacherId?: string | null): string => {
    if (!teacherId) return 'N/A';
    return allTeachersInSchool.find(t => t.id === teacherId)?.name || 'N/A';
  };
  const getAcademicYearName = (yearId?: string | null): string => {
    if (!yearId) return 'General';
    return allAcademicYears.find(ay => ay.id === yearId)?.name || 'N/A';
  };

  const handleAddClassName = async () => {
    if (!currentSchoolId || !newClassNameInput.trim()) {
      toast({ title: "Error", description: "Class name cannot be empty and school context is required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addClassNameAction(newClassNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    setNewClassNameInput('');
    if (result.classNames) {
      setClassNamesList(result.classNames);
    } else if (currentSchoolId) {
      fetchAllData(currentSchoolId);
    }
    setIsSubmitting(false);
  };

  const handleOpenEditClassNameDialog = (classNameRecord: ClassNameRecord) => {
    setEditingClassNameRecord(classNameRecord);
    setEditNameInput(classNameRecord.name);
    setIsEditClassNameDialogOpen(true);
  };

  const handleEditClassNameSubmit = async () => {
    if (!editingClassNameRecord || !editNameInput.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "New name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await updateClassNameAction(editingClassNameRecord.id, editNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.classNames) {
      setClassNamesList(result.classNames);
    } else if (currentSchoolId) {
      fetchAllData(currentSchoolId);
    }
    setIsEditClassNameDialogOpen(false);
    setEditingClassNameRecord(null);
    setIsSubmitting(false);
  };

  const handleDeleteClassName = async (id: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteClassNameAction(id, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.classNames) {
      setClassNamesList(result.classNames);
    } else if (currentSchoolId) {
      fetchAllData(currentSchoolId);
    }
    setIsSubmitting(false);
  };

  const handleAddSectionName = async () => {
    if (!currentSchoolId || !newSectionNameInput.trim()) {
      toast({ title: "Error", description: "Section name cannot be empty and school context is required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addSectionNameAction(newSectionNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    setNewSectionNameInput('');
    if (result.sectionNames) {
      setSectionNamesList(result.sectionNames);
    } else if (currentSchoolId) {
      fetchAllData(currentSchoolId);
    }
    setIsSubmitting(false);
  };

  const handleOpenEditSectionNameDialog = (sectionRecord: SectionRecord) => {
    setEditingSectionNameRecord(sectionRecord);
    setEditNameInput(sectionRecord.name);
    setIsEditSectionNameDialogOpen(true);
  };

  const handleEditSectionNameSubmit = async () => {
    if (!editingSectionNameRecord || !editNameInput.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "New name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await updateSectionNameAction(editingSectionNameRecord.id, editNameInput, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.sectionNames) {
      setSectionNamesList(result.sectionNames);
    } else if (currentSchoolId) {
      fetchAllData(currentSchoolId);
    }
    setIsEditSectionNameDialogOpen(false);
    setEditingSectionNameRecord(null);
    setIsSubmitting(false);
  };

  const handleDeleteSectionName = async (id: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteSectionNameAction(id, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.sectionNames) {
        setSectionNamesList(result.sectionNames);
    } else if (currentSchoolId) {
        fetchAllData(currentSchoolId);
    }
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

    const result = await activateClassSectionAction({
      classNameId: selectedClassNameIdForActivation,
      sectionNameId: selectedSectionNameIdForActivation,
      schoolId: currentSchoolId,
      academicYearId: selectedAcademicYearIdForActivation
    });
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok && currentSchoolId) {
      fetchAllData(currentSchoolId);
      setIsActivateClassSectionDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleDeleteActiveClass = async (activeClassId: string) => {
    if (!currentSchoolId) return;
    if (confirm(`Are you sure you want to delete this active class-section? This will unassign all students.`)) {
      setIsSubmitting(true);
      const result = await deleteActiveClassAction(activeClassId, currentSchoolId);
      toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok && currentSchoolId) {
        fetchAllData(currentSchoolId);
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
    if (result.ok && currentSchoolId) {
      fetchAllData(currentSchoolId);
      setIsManageStudentsDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleOpenAssignTeacherDialog = (cls: ClassData) => {
    setClassToAssignTeacher(cls);
    setSelectedTeacherIdForDialog(cls.teacher_id || 'unassign');
    setIsAssignTeacherDialogOpen(true);
  };

  const handleSaveTeacherAssignment = async () => {
    if (!classToAssignTeacher || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await assignTeacherToClassAction(classToAssignTeacher.id, selectedTeacherIdForDialog, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok && currentSchoolId) {
      fetchAllData(currentSchoolId);
      setIsAssignTeacherDialogOpen(false);
    }
    setIsSubmitting(false);
  };
  
  const handleOpenPromoteDialog = async (cls: ClassData) => {
    if (!currentSchoolId) return;
    setClassToPromote(cls);
    setDestinationClassId('');
    setSelectedStudentsForPromotion([]);
    setPromotionFilter('all');
    setIsPromoteDialogOpen(true);
    setIsFetchingPromotionData(true);
    const result = await getStudentsWithStatusForPromotionAction(cls.id, currentSchoolId);
    if (result.ok && result.studentsWithStatus) {
        setStudentsForPromotion(result.studentsWithStatus);
    } else {
        toast({ title: "Error", description: result.message || "Could not fetch student promotion status.", variant: "destructive" });
        setStudentsForPromotion([]);
    }
    setIsFetchingPromotionData(false);
  };

  const handleConfirmPromotion = async () => {
    if (!classToPromote || !destinationClassId || !currentSchoolId || selectedStudentsForPromotion.length === 0) {
        toast({ title: "Error", description: "Destination class and at least one student must be selected.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await promoteStudentsToNewClassAction(selectedStudentsForPromotion, destinationClassId, currentSchoolId);
    toast({ title: result.ok ? "Promotion Successful" : "Promotion Failed", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
        setIsPromoteDialogOpen(false);
        if (currentSchoolId) fetchAllData(currentSchoolId);
    }
    setIsSubmitting(false);
  };
  
  const handleOpenAssignSubjectsDialog = async (cls: ClassData) => {
    if (!currentSchoolId) return;
    setClassToAssignSubjects(cls);
    setIsSubmitting(true); // Use as loading state
    const result = await getAssignedSubjectsForClassAction(cls.id, currentSchoolId);
    if(result.ok && result.subjectIds) {
      setSelectedSubjectIdsForDialog(result.subjectIds);
    } else {
      toast({ title: "Error", description: "Could not fetch currently assigned subjects.", variant: "destructive" });
      setSelectedSubjectIdsForDialog([]);
    }
    setIsSubmitting(false);
    setIsAssignSubjectsDialogOpen(true);
  };

  const handleSaveSubjectAssignments = async () => {
    if (!classToAssignSubjects || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await saveClassSubjectAssignmentsAction(classToAssignSubjects.id, selectedSubjectIdsForDialog, currentSchoolId);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if(result.ok && currentSchoolId) {
        fetchAllData(currentSchoolId);
        setIsAssignSubjectsDialogOpen(false);
    }
    setIsSubmitting(false);
  };

  const handleSubjectSelectionChange = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIdsForDialog(prev =>
      checked ? [...prev, subjectId] : prev.filter(id => id !== subjectId)
    );
  };

  const destinationClassesForPromotion = useMemo(() => {
    if (!classToPromote) return [];
    return activeClasses.filter(ac => ac.id !== classToPromote.id);
  }, [activeClasses, classToPromote]);
  
  const filteredStudentsForPromotion = useMemo(() => {
      if (promotionFilter === 'all') return studentsForPromotion;
      return studentsForPromotion.filter(s => s.promotionStatus.toLowerCase() === promotionFilter);
  }, [studentsForPromotion, promotionFilter]);

  const handleSelectAllForPromotion = (checked: boolean) => {
    if(checked) {
        setSelectedStudentsForPromotion(filteredStudentsForPromotion.map(s => s.id));
    } else {
        setSelectedStudentsForPromotion([]);
    }
  };
  
  const handleSingleStudentPromotionSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentsForPromotion(prev => 
      checked ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
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
                  <TableHeader><TableRow><TableHead>Class Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {classNamesList.map(cn => (
                      <TableRow key={cn.id}>
                        <TableCell>{cn.name}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditClassNameDialog(cn)} disabled={isSubmitting}><Edit2 className="h-4 w-4" /></Button>
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
                  <TableHeader><TableRow><TableHead>Section Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sectionNamesList.map(sn => (
                      <TableRow key={sn.id}>
                        <TableCell>{sn.name}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditSectionNameDialog(sn)} disabled={isSubmitting}><Edit2 className="h-4 w-4" /></Button>
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
                <CardDescription>Combine a Class Name with a Section Name to make it an assignable unit. Students and teachers are assigned here.</CardDescription>
              </div>
              <Button onClick={handleOpenActivateDialog} className="mt-2 sm:mt-0" disabled={isSubmitting || isLoading}><PlusCircle className="mr-2 h-4 w-4" /> Activate New Class-Section</Button>
            </CardHeader>
            <CardContent>
             {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : paginatedActiveClasses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Section/Division</TableHead>
                       <TableHead>Academic Year</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Subjects</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActiveClasses.map((cls) => {
                       const studentCount = allStudentsInSchool.filter(s => s.class_id === cls.id).length;
                       return (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.division}</TableCell>
                        <TableCell>{getAcademicYearName(cls.academic_year_id)}</TableCell>
                        <TableCell>{getTeacherName(cls.teacher_id)}</TableCell>
                        <TableCell>{studentCount}</TableCell>
                        <TableCell>{(cls as any).subjects_count || 0}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleOpenManageStudentsDialog(cls)}>
                                <Users className="mr-2 h-4 w-4" /> Manage Students
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleOpenAssignTeacherDialog(cls)}>
                                <UserCog className="mr-2 h-4 w-4" /> Assign Teacher
                              </DropdownMenuItem>
                               <DropdownMenuItem onSelect={() => handleOpenAssignSubjectsDialog(cls)}>
                                <BookOpenText className="mr-2 h-4 w-4" /> Assign Subjects
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleOpenPromoteDialog(cls)} disabled={studentCount === 0}>
                                <ArrowRight className="mr-2 h-4 w-4" /> Promote Class
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleDeleteActiveClass(cls.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Class-Section
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              ) : <p className="text-center text-muted-foreground py-4">No class-sections activated yet. Activate one to assign students/teachers.</p>}
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Promote Students from {classToPromote?.name} - {classToPromote?.division}</DialogTitle>
            <CardDescription>
              Select students to promote based on their 'End Term' exam status.
            </CardDescription>
          </DialogHeader>
          {isFetchingPromotionData ? (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Fetching exam results...</span>
            </div>
          ) : (
          <>
            <div className="grid gap-4 py-4">
                <div>
                  <Label>Filter Students by Status</Label>
                  <Select value={promotionFilter} onValueChange={(val) => setPromotionFilter(val as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Students ({studentsForPromotion.length})</SelectItem>
                      <SelectItem value="Pass">Passed ({studentsForPromotion.filter(s => s.promotionStatus === 'Pass').length})</SelectItem>
                      <SelectItem value="Fail">Failed ({studentsForPromotion.filter(s => s.promotionStatus === 'Fail').length})</SelectItem>
                      <SelectItem value="Incomplete">Incomplete ({studentsForPromotion.filter(s => s.promotionStatus === 'Incomplete').length})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 border p-2 rounded-md">
                   <div className="flex items-center space-x-2 p-2 border-b">
                      <Checkbox
                        id="select-all-promotion"
                        onCheckedChange={handleSelectAllForPromotion}
                        checked={filteredStudentsForPromotion.length > 0 && selectedStudentsForPromotion.length === filteredStudentsForPromotion.length}
                      />
                      <Label htmlFor="select-all-promotion" className="font-semibold">Select All Visible ({selectedStudentsForPromotion.length} selected)</Label>
                    </div>
                    {filteredStudentsForPromotion.length > 0 ? filteredStudentsForPromotion.map(student => (
                      <div key={student.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-muted">
                         <Checkbox
                          id={`promo-student-${student.id}`}
                          checked={selectedStudentsForPromotion.includes(student.id)}
                          onCheckedChange={(checked) => handleSingleStudentPromotionSelection(student.id, !!checked)}
                        />
                        <Label htmlFor={`promo-student-${student.id}`} className="flex-grow cursor-pointer flex justify-between items-center">
                          {student.name}
                           <Badge variant={student.promotionStatus === 'Pass' ? 'default' : student.promotionStatus === 'Fail' ? 'destructive' : 'secondary'}>
                                {student.promotionStatus}
                           </Badge>
                        </Label>
                      </div>
                    )) : <p className="text-sm text-muted-foreground text-center py-4">No students match the filter.</p>}
                </div>
                <div>
                  <Label htmlFor="destinationClassSelect">Promote Selected Students to</Label>
                  <Select value={destinationClassId} onValueChange={setDestinationClassId}>
                    <SelectTrigger id="destinationClassSelect">
                      <SelectValue placeholder="Choose the destination class" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationClassesForPromotion.length > 0 ? (
                        destinationClassesForPromotion.map(cls => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division} ({getAcademicYearName(cls.academic_year_id)})</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-options" disabled>No other classes available for promotion</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button onClick={handleConfirmPromotion} disabled={isSubmitting || !destinationClassId || selectedStudentsForPromotion.length === 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Promote {selectedStudentsForPromotion.length} Student(s)
              </Button>
            </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAssignSubjectsDialogOpen} onOpenChange={setIsAssignSubjectsDialogOpen}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Subjects to {classToAssignSubjects?.name} - {classToAssignSubjects?.division}</DialogTitle>
            <CardDescription>Select the subjects to be taught in this class.</CardDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 overflow-y-auto flex-grow">
            {allSubjectsInSchool.length > 0 ? allSubjectsInSchool.map(subject => (
              <div key={subject.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                <Checkbox
                  id={`subject-${subject.id}`}
                  checked={selectedSubjectIdsForDialog.includes(subject.id)}
                  onCheckedChange={(checked) => handleSubjectSelectionChange(subject.id, !!checked)}
                  disabled={isSubmitting}
                />
                <Label htmlFor={`subject-${subject.id}`} className="flex-grow cursor-pointer">
                  {subject.name} <span className="text-xs text-muted-foreground">({subject.code})</span>
                </Label>
              </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No subjects have been defined for this school yet.</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveSubjectAssignments} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Subject Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog for Activating Class Section */}
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
                  {classNamesList.length === 0 && <SelectItem value="no-class-names-placeholder" disabled>No class names defined</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="selectSectionNameForActivation">Select Section/Division Name</Label>
              <Select value={selectedSectionNameIdForActivation} onValueChange={setSelectedSectionNameIdForActivation} disabled={isSubmitting}>
                <SelectTrigger id="selectSectionNameForActivation"><SelectValue placeholder="Choose a section name" /></SelectTrigger>
                <SelectContent>
                  {sectionNamesList.map(sn => (<SelectItem key={sn.id} value={sn.id}>{sn.name}</SelectItem>))}
                  {sectionNamesList.length === 0 && <SelectItem value="no-section-names-placeholder" disabled>No section names defined</SelectItem>}
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
                  {allAcademicYears.length === 0 && <SelectItem value="no-academic-years-placeholder" disabled>No academic years defined</SelectItem>}
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

      {/* Dialog for Editing Class Name */}
      <Dialog open={isEditClassNameDialogOpen} onOpenChange={setIsEditClassNameDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Class Name: {editingClassNameRecord?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="editClassNameInput">New Class Name</Label>
                <Input
                    id="editClassNameInput"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    placeholder="Enter new class name"
                    disabled={isSubmitting}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleEditClassNameSubmit} disabled={isSubmitting || !editNameInput.trim()}>
                     {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Editing Section Name */}
      <Dialog open={isEditSectionNameDialogOpen} onOpenChange={setIsEditSectionNameDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Section Name: {editingSectionNameRecord?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="editSectionNameInput">New Section Name</Label>
                <Input
                    id="editSectionNameInput"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    placeholder="Enter new section name"
                    disabled={isSubmitting}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleEditSectionNameSubmit} disabled={isSubmitting || !editNameInput.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Managing Students in a Class */}
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

      {/* Dialog for Assigning Teacher to a Class */}
      <Dialog open={isAssignTeacherDialogOpen} onOpenChange={(isOpen) => { setIsAssignTeacherDialogOpen(isOpen); if (!isOpen) setClassToAssignTeacher(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {classToAssignTeacher?.name} - {classToAssignTeacher?.division}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="teacherSelect">Select Teacher</Label>
              <Select value={selectedTeacherIdForDialog || 'unassign'} onValueChange={(val) => setSelectedTeacherIdForDialog(val === 'unassign' ? null : val)} disabled={isSubmitting}>
                <SelectTrigger id="teacherSelect"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Unassign Teacher</SelectItem>
                  {allTeachersInSchool.map(teacher => (<SelectItem key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.subject})</SelectItem>))}
                  {allTeachersInSchool.length === 0 && <SelectItem value="no-teachers-placeholder" disabled>No teachers available</SelectItem>}
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
