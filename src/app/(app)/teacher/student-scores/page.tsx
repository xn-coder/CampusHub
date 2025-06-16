
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { ClassData, Student, Exam, Subject } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, Users, FileText, Loader2, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { saveStudentScoresAction } from './actions';

export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, string | number>>({}); 
  
  const [isLoading, setIsLoading] = useState(false); // General loading for operations like saving
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true); // For initial setup
  const [isFetchingStudents, setIsFetchingStudents] = useState(false); // For fetching students of a class
  const [isFetchingScores, setIsFetchingScores] = useState(false); // For fetching scores for an exam

  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [currentScoreInput, setCurrentScoreInput] = useState<string | number>('');

  useEffect(() => {
    const teacherUserId = localStorage.getItem('currentUserId');
    if (teacherUserId) {
      supabase.from('teachers').select('id, school_id').eq('user_id', teacherUserId).single()
        .then(({ data: teacherProfile, error: profileError }) => {
          if (profileError || !teacherProfile) {
            toast({ title: "Error", description: "Could not load teacher profile.", variant: "destructive"});
            setIsFetchingInitialData(false); return;
          }
          setCurrentTeacherId(teacherProfile.id);
          setCurrentSchoolId(teacherProfile.school_id);

          if (teacherProfile.id && teacherProfile.school_id) {
            Promise.all([
                supabase.from('classes').select('*').eq('teacher_id', teacherProfile.id).eq('school_id', teacherProfile.school_id),
                supabase.from('exams').select('*').eq('school_id', teacherProfile.school_id),
                supabase.from('subjects').select('*').eq('school_id', teacherProfile.school_id),
            ]).then(([classesRes, examsRes, subjectsRes]) => {
                if (classesRes.error) toast({ title: "Error fetching classes", variant: "destructive" });
                else setAssignedClasses(classesRes.data || []);
                
                if (examsRes.error) toast({ title: "Error fetching exams", variant: "destructive" });
                else setAllExams(examsRes.data || []);

                if (subjectsRes.error) toast({ title: "Error fetching subjects", variant: "destructive" });
                else setAllSubjects(subjectsRes.data || []);
                
                setIsFetchingInitialData(false);
            }).catch(err => {
                toast({ title: "Error fetching initial data", description: err.message, variant: "destructive"});
                setIsFetchingInitialData(false);
            });
          } else {
            setIsFetchingInitialData(false);
          }
        });
    } else {
        toast({ title: "Error", description: "Teacher not identified.", variant: "destructive"});
        setIsFetchingInitialData(false);
    }
  }, [toast]);

  useEffect(() => { 
    if (selectedClassId && currentSchoolId) {
      setIsFetchingStudents(true);
      setStudentsInSelectedClass([]); // Reset students when class changes
      setScores({});                 // Reset scores
      setSelectedExamId('');         // Reset selected exam
      supabase.from('students').select('*').eq('class_id', selectedClassId).eq('school_id', currentSchoolId)
        .then(({ data, error }) => {
          if (error) toast({ title: "Error fetching students for class", variant: "destructive" });
          else setStudentsInSelectedClass(data || []);
          setIsFetchingStudents(false);
        });
    } else {
      setStudentsInSelectedClass([]);
      setScores({});
      setSelectedExamId('');
    }
  }, [selectedClassId, currentSchoolId, toast]);

  useEffect(() => {
    if (selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && currentSchoolId) {
      setIsFetchingScores(true);
      supabase.from('student_scores')
        .select('student_id, score')
        .eq('exam_id', selectedExamId)
        .eq('class_id', selectedClassId)
        .eq('school_id', currentSchoolId)
        .in('student_id', studentsInSelectedClass.map(s => s.id))
        .then(({ data: fetchedScoresData, error }) => {
          const newScoresState: Record<string, string | number> = {};
          // Initialize all students in the current class view with an empty score string
          studentsInSelectedClass.forEach(student => {
            newScoresState[student.id] = '';
          });

          if (error) {
            toast({ title: "Error fetching existing scores", description: error.message, variant: "destructive" });
            // newScoresState remains initialized with empty strings
          } else {
            // Populate with fetched scores for those who have them
            (fetchedScoresData || []).forEach(fetchedScore => {
              if (newScoresState.hasOwnProperty(fetchedScore.student_id)) {
                newScoresState[fetchedScore.student_id] = fetchedScore.score;
              }
            });
          }
          setScores(newScoresState);
          setIsFetchingScores(false);
        });
    } else {
      // If no exam selected or no students, reset scores to empty for current students
      const initialScores: Record<string, string | number> = {};
      studentsInSelectedClass.forEach(student => {
        initialScores[student.id] = '';
      });
      setScores(initialScores);
      setIsFetchingScores(false);
    }
  }, [selectedExamId, selectedClassId, studentsInSelectedClass, currentSchoolId, toast]);


  const handleOpenScoreDialog = (student: Student) => {
    setEditingStudent(student);
    setCurrentScoreInput(scores[student.id] || '');
    setIsScoreDialogOpen(true);
  };

  const handleSaveSingleScore = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !selectedExamId || !selectedClassId || !currentTeacherId || !selectedExamDetails || !currentSchoolId) {
      toast({ title: "Error", description: "Required context for saving score is missing.", variant: "destructive"});
      return;
    }
    if (String(currentScoreInput).trim() === '') {
        toast({ title: "Input Required", description: "Please enter a score or grade.", variant: "default"});
        return;
    }
    setIsLoading(true); // Use general loading for save operations

    const scoreToSave = {
      student_id: editingStudent.id,
      exam_id: selectedExamId,
      subject_id: selectedExamDetails.subject_id,
      class_id: selectedClassId,
      score: currentScoreInput,
      max_marks: selectedExamDetails.max_marks,
      recorded_by_teacher_id: currentTeacherId,
      school_id: currentSchoolId,
    };

    const result = await saveStudentScoresAction([scoreToSave]);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    if (result.ok) {
      // Optimistically update local state
      setScores(prev => ({ ...prev, [editingStudent.id]: currentScoreInput }));
      // Optionally, could re-fetch scores for this exam to ensure consistency, but optimistic update is usually enough for single edits.
      // To re-fetch: trigger the score fetching useEffect again, e.g., by slightly changing a dependency or calling a refetch function.
      // For now, relying on the optimistic update.
      setIsScoreDialogOpen(false);
      setEditingStudent(null);
    }
    setIsLoading(false);
  };
  
  const getSubjectName = (subjectId: string) => allSubjects.find(s => s.id === subjectId)?.name || 'N/A';

  const filteredExamsForSelectedClass = selectedClassId 
    ? allExams.filter(exam => exam.class_id === selectedClassId || !exam.class_id)
    : [];
  
  const selectedExamDetails = allExams.find(ex => ex.id === selectedExamId);

  if (isFetchingInitialData) {
      return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading initial data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
       return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Gradebook" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association. Ensure your account is set up.
        </CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Gradebook: Enter Student Scores" 
        description="Select a class and exam to input or update student scores." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> Manage Scores</CardTitle>
          <CardDescription>Choose class, then exam. Click 'Edit Score' to enter/update.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || isFetchingStudents || isFetchingScores}>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Choose your class" />
                </SelectTrigger>
                <SelectContent>
                  {assignedClasses.length > 0 ? assignedClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                  )) : <SelectItem value="-" disabled>No classes assigned</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examSelect">Select Exam</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={isLoading || isFetchingStudents || isFetchingScores || !selectedClassId || filteredExamsForSelectedClass.length === 0}>
                <SelectTrigger id="examSelect">
                  <SelectValue placeholder="Choose an exam" />
                </SelectTrigger>
                <SelectContent>
                  {filteredExamsForSelectedClass.length > 0 ? filteredExamsForSelectedClass.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.name} ({getSubjectName(exam.subject_id)}) - {format(parseISO(exam.date), 'PP')}</SelectItem>
                  )) : <SelectItem value="-" disabled>No exams for this class or no class selected</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFetchingStudents && selectedClassId && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Fetching students...</div>}
          {isFetchingScores && selectedExamId && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Fetching scores...</div>}

          {!isFetchingStudents && !isFetchingScores && selectedClassId && selectedExamId && studentsInSelectedClass.length === 0 && (
             <p className="text-muted-foreground text-center py-4">No students found in the selected class.</p>
          )}

          {!isFetchingStudents && !isFetchingScores && selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">
                Students in {assignedClasses.find(c => c.id === selectedClassId)?.name} - {assignedClasses.find(c => c.id === selectedClassId)?.division}
                <span className="block text-sm text-muted-foreground">
                  Exam: {selectedExamDetails?.name} (Subject: {selectedExamDetails ? getSubjectName(selectedExamDetails.subject_id) : 'N/A'})
                  {selectedExamDetails?.max_marks && ` - Max Marks: ${selectedExamDetails.max_marks}`}
                </span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {studentsInSelectedClass.map(student => (
                  <Card key={student.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{student.name}</CardTitle>
                      <CardDescription>
                        Current Score: <span className="font-semibold">{scores[student.id] || 'Not Entered'}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button variant="outline" size="sm" onClick={() => handleOpenScoreDialog(student)} disabled={isLoading || isFetchingScores}>
                        <Edit2 className="mr-1 h-3 w-3"/> Edit Score
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Score for {editingStudent?.name}</DialogTitle>
            <CardDescription>
              Exam: {selectedExamDetails?.name}
              {selectedExamDetails?.max_marks && ` (Max Marks: ${selectedExamDetails.max_marks})`}
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSingleScore}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="currentScoreInput">Score/Grade</Label>
                <Input 
                  id="currentScoreInput" 
                  value={currentScoreInput} 
                  onChange={(e) => setCurrentScoreInput(e.target.value)} 
                  placeholder={selectedExamDetails?.max_marks ? `Score (out of ${selectedExamDetails.max_marks})` : "Enter score or grade"}
                  required 
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isLoading || String(currentScoreInput).trim() === ''}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save Score
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

