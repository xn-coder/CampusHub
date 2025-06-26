
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student, Exam, Subject } from '@/types';
import { useState, useEffect, type FormEvent, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, Users, FileText, Loader2, Edit2 } from 'lucide-react';
import { 
  getTeacherStudentScoresPageInitialDataAction, 
  getStudentsForClassAction, 
  getScoresForExamAndStudentAction,
  saveStudentScoresAction 
} from './actions';

export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, string | number>>({}); // subjectId: score
  
  const [isLoading, setIsLoading] = useState(false); 
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true); 
  const [isFetchingStudents, setIsFetchingStudents] = useState(false); 
  const [isFetchingScores, setIsFetchingScores] = useState(false); 

  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsFetchingInitialData(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher not identified.", variant: "destructive"});
      setIsFetchingInitialData(false);
      return;
    }
    const result = await getTeacherStudentScoresPageInitialDataAction(teacherUserId);
    if (result.ok) {
      setCurrentTeacherId(result.teacherProfileId || null);
      setCurrentSchoolId(result.schoolId || null);
      setAssignedClasses(result.assignedClasses || []);
      setAllExams(result.allExams || []);
      setAllSubjects(result.allSubjects || []);
    } else {
      toast({ title: "Error loading initial data", description: result.message, variant: "destructive" });
    }
    setIsFetchingInitialData(false);
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchStudentsForClass = useCallback(async (classId: string, schoolId: string) => {
    setIsFetchingStudents(true);
    setStudentsInSelectedClass([]);
    setSelectedStudentId('');
    setScores({});                 
    setSelectedExamId('');         
    const result = await getStudentsForClassAction(classId, schoolId);
    if (result.ok && result.students) {
      setStudentsInSelectedClass(result.students);
    } else {
      toast({ title: "Error fetching students for class", description: result.message, variant: "destructive" });
    }
    setIsFetchingStudents(false);
  }, [toast]);

  useEffect(() => { 
    if (selectedClassId && currentSchoolId) {
      fetchStudentsForClass(selectedClassId, currentSchoolId);
    }
  }, [selectedClassId, currentSchoolId, fetchStudentsForClass]);

  const fetchScores = useCallback(async () => {
    if (selectedStudentId && selectedExamId && currentSchoolId) {
      setIsFetchingScores(true);
      const result = await getScoresForExamAndStudentAction(selectedExamId, selectedStudentId, currentSchoolId);
      if (result.ok && result.scores) {
        setScores(result.scores);
      } else {
        toast({ title: "Error fetching existing scores", description: result.message, variant: "destructive" });
        setScores({});
      }
      setIsFetchingScores(false);
    }
  }, [selectedStudentId, selectedExamId, currentSchoolId, toast]);

  useEffect(() => {
    if (selectedStudentId && selectedExamId) {
      fetchScores();
    } else {
      setScores({});
    }
  }, [selectedStudentId, selectedExamId, fetchScores]);

  const handleScoreChange = (subjectId: string, value: string) => {
    setScores(prev => ({ ...prev, [subjectId]: value }));
  };

  const handleSaveScores = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedExamId || !selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Required context (Class, Student, Exam) is missing.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const selectedExamDetails = allExams.find(ex => ex.id === selectedExamId);

    const scoresToSave = Object.entries(scores)
      .filter(([_, score]) => String(score).trim() !== '')
      .map(([subjectId, score]) => ({
        student_id: selectedStudentId,
        exam_id: selectedExamId,
        subject_id: subjectId,
        class_id: selectedClassId,
        score: score,
        max_marks: selectedExamDetails?.max_marks,
        recorded_by_teacher_id: currentTeacherId,
        school_id: currentSchoolId,
      }));

    if (scoresToSave.length === 0) {
      toast({ title: "No scores to save", description: "Please enter at least one score.", variant: "default" });
      setIsLoading(false);
      return;
    }

    const result = await saveStudentScoresAction(scoresToSave);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    setIsLoading(false);
  };
  
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
        description="Select a class, student, and exam to input scores for all subjects." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> Manage Scores</CardTitle>
          <CardDescription>Select a class, student, and exam to begin grading.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">1. Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isFetchingStudents || isFetchingInitialData || assignedClasses.length === 0}>
                <SelectTrigger id="classSelect"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {assignedClasses.map(cls => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="studentSelect">2. Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={isFetchingStudents || studentsInSelectedClass.length === 0}>
                <SelectTrigger id="studentSelect"><SelectValue placeholder="Choose a student" /></SelectTrigger>
                <SelectContent>
                  {studentsInSelectedClass.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examSelect">3. Select Exam</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!selectedStudentId || allExams.length === 0}>
                <SelectTrigger id="examSelect"><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                <SelectContent>
                  {allExams.map(exam => (<SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(isFetchingStudents || isFetchingScores) && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Loading...</div>}

          {selectedClassId && selectedStudentId && selectedExamId && !isFetchingScores && !isFetchingStudents && (
            <form onSubmit={handleSaveScores}>
              <h3 className="text-lg font-medium mb-4">
                Enter Scores for: {studentsInSelectedClass.find(s => s.id === selectedStudentId)?.name}
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Max Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSubjects.map(subject => (
                      <TableRow key={subject.id}>
                        <TableCell>{subject.name}</TableCell>
                        <TableCell>
                          <Input 
                            value={scores[subject.id] || ''}
                            onChange={(e) => handleScoreChange(subject.id, e.target.value)}
                            placeholder="Enter score"
                          />
                        </TableCell>
                        <TableCell>{allExams.find(ex => ex.id === selectedExamId)?.max_marks || 100}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="submit" className="mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save All Scores
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
