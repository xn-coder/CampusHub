
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Exam, Subject, ClassData, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, FileTextIcon, BellRing } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';

const MOCK_EXAMS_KEY = 'mockExamsData';
const MOCK_SUBJECTS_KEY = 'mockSubjectsData';
const MOCK_CLASSES_KEY = 'mockClassesData'; // Active class-sections
const MOCK_ACADEMIC_YEARS_KEY = 'mockAcademicYearsData';


export default function ExamsPage() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form state
  const [examName, setExamName] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | undefined>(undefined);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedExams = localStorage.getItem(MOCK_EXAMS_KEY);
      if (storedExams) setExams(JSON.parse(storedExams));
      else localStorage.setItem(MOCK_EXAMS_KEY, JSON.stringify([]));

      const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
      if (storedSubjects) setSubjects(JSON.parse(storedSubjects));
      else localStorage.setItem(MOCK_SUBJECTS_KEY, JSON.stringify([]));
      
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      if (storedClasses) setActiveClasses(JSON.parse(storedClasses));
      else localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify([]));
      
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
    setExamName('');
    setSelectedSubjectId('');
    setSelectedClassSectionId(undefined);
    setSelectedAcademicYearId(undefined);
    setExamDate('');
    setStartTime('');
    setEndTime('');
    setEditingExam(null);
  };

  const handleOpenDialog = (exam?: Exam) => {
    if (exam) {
      setEditingExam(exam);
      setExamName(exam.name);
      setSelectedSubjectId(exam.subjectId);
      setSelectedClassSectionId(exam.classSectionId);
      setSelectedAcademicYearId(exam.academicYearId);
      setExamDate(exam.date);
      setStartTime(exam.startTime);
      setEndTime(exam.endTime);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!examName.trim() || !selectedSubjectId || !examDate || !startTime || !endTime) {
      toast({ title: "Error", description: "Exam Name, Subject, Date, Start Time, and End Time are required.", variant: "destructive" });
      return;
    }

    let updatedExams;
    const examData = {
      name: examName.trim(),
      subjectId: selectedSubjectId,
      classSectionId: selectedClassSectionId === 'none_cs_selection' ? undefined : selectedClassSectionId,
      academicYearId: selectedAcademicYearId === 'none_ay_selection' ? undefined : selectedAcademicYearId,
      date: examDate,
      startTime,
      endTime,
    };

    if (editingExam) {
      updatedExams = exams.map(ex =>
        ex.id === editingExam.id ? { ...ex, ...examData } : ex
      );
      toast({ title: "Exam Updated", description: `${examName.trim()} has been updated.` });
    } else {
      const newExam: Exam = {
        id: `exam-${Date.now()}`,
        ...examData,
      };
      updatedExams = [newExam, ...exams];
      toast({ title: "Exam Added", description: `${examName.trim()} has been scheduled.` });
    }
    
    updatedExams.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setExams(updatedExams);
    updateLocalStorage(MOCK_EXAMS_KEY, updatedExams);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteExam = (examId: string) => {
    if (confirm("Are you sure you want to delete this exam?")) {
      const updatedExams = exams.filter(ex => ex.id !== examId);
      setExams(updatedExams);
      updateLocalStorage(MOCK_EXAMS_KEY, updatedExams);
      toast({ title: "Exam Deleted", variant: "destructive" });
    }
  };
  
  const handleMockNotify = (exam: Exam) => {
    toast({
      title: "Notification Simulated",
      description: `Students and teachers for exam '${exam.name}' would be notified. (This is a mock action)`,
    });
  };

  const getSubjectName = (subjectId: string) => subjects.find(s => s.id === subjectId)?.name || 'N/A';
  const getClassSectionName = (csId?: string) => {
    if (!csId) return 'All Classes';
    const cs = activeClasses.find(c => c.id === csId);
    return cs ? `${cs.name} - ${cs.division}` : 'N/A';
  };
  const getAcademicYearName = (ayId?: string) => {
    if (!ayId) return 'N/A';
    return academicYears.find(ay => ay.id === ayId)?.name || 'N/A';
  };
  const formatDateString = (dateString: string) => {
    if (!dateString) return 'N/A';
    const dateObj = parseISO(dateString);
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Exams Management" 
        description="Schedule and manage school examinations. Link exams to subjects, classes, and academic years."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Schedule Exam
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileTextIcon className="mr-2 h-5 w-5" />Examination Schedule</CardTitle>
          <CardDescription>Oversee all examination-related activities.</CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No exams scheduled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class/Section</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.name}</TableCell>
                    <TableCell>{getSubjectName(exam.subjectId)}</TableCell>
                    <TableCell>{getClassSectionName(exam.classSectionId)}</TableCell>
                    <TableCell>{getAcademicYearName(exam.academicYearId)}</TableCell>
                    <TableCell>{formatDateString(exam.date)}</TableCell>
                    <TableCell>{exam.startTime} - {exam.endTime}</TableCell>
                    <TableCell className="space-x-1 text-right">
                       <Button variant="outline" size="sm" onClick={() => handleMockNotify(exam)} title="Simulate Notification">
                        <BellRing className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(exam)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteExam(exam.id)}>
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="examName" className="text-right">Exam Name</Label>
                <Input id="examName" value={examName} onChange={(e) => setExamName(e.target.value)} className="col-span-3" placeholder="e.g., Midterm, Final" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subjectId" className="text-right">Subject</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} required>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.length > 0 ? subjects.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)) : <SelectItem value="-" disabled>No subjects defined</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="classSectionId" className="text-right">Class/Section</Label>
                <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Optional: Specific Class/Section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_cs_selection">All (General Exam)</SelectItem>
                    {activeClasses.length > 0 ? activeClasses.map(cs => (<SelectItem key={cs.id} value={cs.id}>{cs.name} - {cs.division}</SelectItem>)) : <SelectItem value="-" disabled>No active classes</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="academicYearId" className="text-right">Academic Year</Label>
                <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Optional: Academic Year" /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="none_ay_selection">None</SelectItem>
                    {academicYears.length > 0 ? academicYears.map(ay => (<SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)) : <SelectItem value="-" disabled>No academic years</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="examDate" className="text-right">Date</Label>
                <Input id="examDate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startTime" className="text-right">Start Time</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endTime" className="text-right">End Time</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" required />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingExam ? 'Save Changes' : 'Schedule Exam'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
