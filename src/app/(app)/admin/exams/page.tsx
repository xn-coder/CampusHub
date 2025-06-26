
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Exam, Subject, ClassData, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, FileTextIcon, BellRing, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { getExamsPageDataAction, addExamAction, updateExamAction, deleteExamAction } from './actions';

export default function ExamsPage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form state
  const [examName, setExamName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxMarks, setMaxMarks] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);


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
    const result = await getExamsPageDataAction(adminUserId);
    if (result.ok) {
      setCurrentSchoolId(result.schoolId || null);
      setExams(result.exams || []);
      setSubjects(result.subjects || []);
      setActiveClasses(result.activeClasses || []);
      setAcademicYears(result.academicYears || []);
    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }

  const resetForm = () => {
    setExamName(''); setSelectedClassId(undefined);
    setSelectedAcademicYearId(undefined); setExamDate(''); setStartTime('');
    setEndTime(''); setMaxMarks(''); setEditingExam(null);
    setSelectedSubjectIds([]);
  };

  const handleOpenDialog = (exam?: Exam) => {
    if (exam) {
      setEditingExam(exam);
      setExamName(exam.name);
      setSelectedClassId(exam.class_id || undefined);
      setSelectedAcademicYearId(exam.academic_year_id || undefined);
      setExamDate(exam.date ? format(parseISO(exam.date), 'yyyy-MM-dd') : '');
      setStartTime(exam.start_time || '');
      setEndTime(exam.end_time || '');
      setMaxMarks(exam.max_marks?.toString() || '');
      // Editing one exam at a time, so we just set its subject
      setSelectedSubjectIds(exam.subject_id ? [exam.subject_id] : []);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubjectSelection = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds(prev =>
      checked ? [...prev, subjectId] : prev.filter(id => id !== subjectId)
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId) {
       toast({ title: "Error", description: "School context is missing.", variant: "destructive" });
       return;
    }
    setIsSubmitting(true);
    
    if (editingExam) {
      if (!examName.trim() || !examDate) {
         toast({ title: "Error", description: "Exam Name and Date are required for update.", variant: "destructive" });
         setIsSubmitting(false);
         return;
      }
      // Update logic for a single exam
      const result = await updateExamAction(editingExam.id, {
        name: examName.trim(),
        class_id: selectedClassId === 'none_cs_selection' ? null : selectedClassId,
        academic_year_id: selectedAcademicYearId === 'none_ay_selection' ? null : selectedAcademicYearId,
        date: examDate,
        start_time: startTime || null,
        end_time: endTime || null,
        max_marks: maxMarks !== '' ? Number(maxMarks) : null,
        school_id: currentSchoolId,
        subject_id: editingExam.subject_id, // Subject is not editable
      });
      if(result.ok) {
        toast({ title: "Exam Updated", description: result.message });
        if (localStorage.getItem('currentUserId')) loadInitialData(localStorage.getItem('currentUserId')!);
        setIsDialogOpen(false);
        resetForm();
      } else {
        toast({ title: "Error Updating Exam", description: result.message, variant: "destructive" });
      }

    } else {
      // Create logic for multiple subjects
      if (!examName.trim() || !examDate || selectedSubjectIds.length === 0) {
        toast({ title: "Error", description: "Exam Name, Date, and at least one Subject are required.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const commonExamData = {
        class_id: selectedClassId === 'none_cs_selection' ? null : selectedClassId,
        academic_year_id: selectedAcademicYearId === 'none_ay_selection' ? null : selectedAcademicYearId,
        date: examDate,
        start_time: startTime || null,
        end_time: endTime || null,
        max_marks: maxMarks !== '' ? Number(maxMarks) : null,
        school_id: currentSchoolId,
      };

      const examInputs = selectedSubjectIds.map(subjectId => {
        const subjectName = subjects.find(s => s.id === subjectId)?.name || 'Subject';
        return {
          ...commonExamData,
          name: `${examName.trim()} - ${subjectName}`,
          subject_id: subjectId,
        };
      });

      const result = await addExamAction(examInputs);
      
      toast({
        title: result.ok ? "Exams Scheduled" : "Scheduling Issue",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
        duration: result.ok ? 5000 : 10000,
      });

      if (result.savedCount > 0) {
        if (localStorage.getItem('currentUserId')) loadInitialData(localStorage.getItem('currentUserId')!);
        setIsDialogOpen(false);
        resetForm();
      }
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteExam = async (examId: string) => {
    if (!currentSchoolId) return;
    if (confirm("Are you sure you want to delete this exam schedule?")) {
      setIsSubmitting(true);
      const result = await deleteExamAction(examId, currentSchoolId);
      toast({ title: result.ok ? "Exam Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok) {
        const adminUserId = localStorage.getItem('currentUserId');
        if (adminUserId) loadInitialData(adminUserId);
      }
      setIsSubmitting(false);
    }
  };
  
  const handleMockNotify = (exam: Exam) => {
    toast({
      title: "Notification Simulated",
      description: `Students and teachers for exam '${exam.name}' would be notified. (This is a mock action)`,
    });
  };

  const getSubjectName = (exam: Exam) => {
      if (!exam.subject_id) return 'N/A';
      const subject = exam.subject as any; // Cast because Supabase join type can be complex
      return subject?.name ? `${subject.name} (${subject.code})` : 'Unknown';
  };

  const getClassSectionName = (exam: Exam) => {
    if (!exam.class_id) return 'All Classes';
    const classInfo = exam.class as any;
    return classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';
  };
  
  const formatDateString = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const dateObj = parseISO(dateString);
    return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Exams Management" 
        description="Schedule and manage school examination events."
        actions={
          <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isLoading || isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Schedule Exam
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileTextIcon className="mr-2 h-5 w-5" />Examination Schedule</CardTitle>
          <CardDescription>Oversee all examination-related activities. Scores for each subject are entered by teachers in the Gradebook.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage exams.</p>
          ) : exams.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No exams scheduled yet for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class/Section</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Max Marks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.name}</TableCell>
                    <TableCell>{getSubjectName(exam)}</TableCell>
                    <TableCell>{getClassSectionName(exam)}</TableCell>
                    <TableCell>{formatDateString(exam.date)}</TableCell>
                    <TableCell>{exam.max_marks ?? 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                       <Button variant="outline" size="sm" onClick={() => handleMockNotify(exam)} title="Simulate Notification" disabled={isSubmitting}>
                        <BellRing className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(exam)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteExam(exam.id)} disabled={isSubmitting}>
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
            <DialogTitle>{editingExam ? 'Edit' : 'Schedule New'} Exam</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="examName">Exam Name</Label>
                <Input id="examName" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g., Midterm, Final Term" required disabled={isSubmitting} />
              </div>

              {!editingExam && (
                <div>
                    <Label>Subjects</Label>
                    <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-2">
                    {subjects.length > 0 ? subjects.map(subject => (
                        <div key={subject.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`subject-${subject.id}`}
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(checked) => handleSubjectSelection(subject.id, !!checked)}
                            disabled={isSubmitting}
                        />
                        <Label htmlFor={`subject-${subject.id}`} className="font-normal">{subject.name} ({subject.code})</Label>
                        </div>
                    )) : <p className="text-xs text-muted-foreground p-2">No subjects found. Please add subjects first.</p>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">An exam record will be created for each selected subject.</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="classId">Target Class/Section (Optional)</Label>
                <Select value={selectedClassId || 'none_cs_selection'} onValueChange={setSelectedClassId} disabled={isSubmitting}>
                  <SelectTrigger id="classId"><SelectValue placeholder="All (General Exam)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_cs_selection">All (General Exam)</SelectItem>
                    {activeClasses.length > 0 ? activeClasses.map(cs => (<SelectItem key={cs.id} value={cs.id}>{cs.name} - {cs.division}</SelectItem>)) : <SelectItem value="-" disabled>No active classes</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="academicYearId">Academic Year (Optional)</Label>
                <Select value={selectedAcademicYearId || 'none_ay_selection'} onValueChange={setSelectedAcademicYearId} disabled={isSubmitting}>
                  <SelectTrigger id="academicYearId"><SelectValue placeholder="General / Not linked" /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="none_ay_selection">General / Not Linked</SelectItem>
                    {academicYears.length > 0 ? academicYears.map(ay => (<SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)) : <SelectItem value="-" disabled>No academic years</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="examDate">Exam Date</Label>
                <Input id="examDate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time (Optional)</Label>
                  <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isSubmitting} />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time (Optional)</Label>
                  <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
               <div>
                <Label htmlFor="maxMarks">Default Max Marks (per subject)</Label>
                <Input id="maxMarks" type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} placeholder="e.g., 100" min="0" disabled={isSubmitting} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingExam ? 'Save Changes' : 'Schedule Exam(s)'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
