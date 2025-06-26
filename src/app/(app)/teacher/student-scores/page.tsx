"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student, Exam, Subject } from '@/types';
import { useState, useEffect, type FormEvent, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, Users, FileText, Loader2, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { 
  getTeacherStudentScoresPageInitialDataAction, 
  getStudentsForClassAction, 
  getScoresForExamAndStudentAction,
  saveSingleScoreAction // Renamed for clarity
} from './actions';


export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [score, setScore] = useState<string | number>(''); 

  const [isLoading, setIsLoading] = useState(false); 
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true); 
  const [isFetchingStudents, setIsFetchingStudents] = useState(false); 
  const [isFetchingScore, setIsFetchingScore] = useState(false); 

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
    setSelectedExamId('');
    setScore('');
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
  
  const fetchScore = useCallback(async () => {
    if (selectedStudentId && selectedExamId && currentSchoolId) {
      setIsFetchingScore(true);
      const selectedExam = allExams.find(e => e.id === selectedExamId);
      if (!selectedExam) {
        setScore('');
        setIsFetchingScore(false);
        return;
      }
      
      const { data: scoreData, error } = await supabase
        .from('student_scores')
        .select('score')
        .eq('student_id', selectedStudentId)
        .eq('exam_id', selectedExamId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // Ignore "No rows found"
        toast({ title: "Error fetching existing score", description: error.message, variant: "destructive" });
        setScore('');
      } else {
        setScore(scoreData?.score || '');
      }
      
      setIsFetchingScore(false);
    }
  }, [selectedStudentId, selectedExamId, currentSchoolId, allExams, toast]);
  
  useEffect(() => {
    if (selectedStudentId && selectedExamId) {
      fetchScore();
    } else {
      setScore('');
    }
  }, [selectedStudentId, selectedExamId, fetchScore]);

  const handleSaveScore = async (e: FormEvent) => {
    e.preventDefault();
    const selectedExam = allExams.find(exam => exam.id === selectedExamId);
    if (!selectedStudentId || !selectedExam || !selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "All fields (Class, Student, Exam) must be selected.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    const scoreToSave = {
      student_id: selectedStudentId,
      exam_id: selectedExamId,
      subject_id: selectedExam.subject_id,
      class_id: selectedClassId,
      score: String(score).trim() === '' ? null : score,
      max_marks: selectedExam.max_marks,
      recorded_by_teacher_id: currentTeacherId,
      school_id: currentSchoolId,
    };
    
    if (scoreToSave.score === null) {
      toast({title: "Info", description: "Score field was empty, no changes saved."});
      setIsLoading(false);
      return;
    }

    const result = await saveSingleScoreAction(scoreToSave);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    setIsLoading(false);
  };
  
  const relevantExams = useMemo(() => {
      if (!selectedClassId) return [];
      return allExams.filter(exam => exam.class_id === selectedClassId);
  }, [allExams, selectedClassId]);

  const selectedExamDetails = useMemo(() => {
      return allExams.find(e => e.id === selectedExamId);
  }, [selectedExamId, allExams]);

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
        description="Select a class, student, and a specific exam to input the score." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> Manage Scores</CardTitle>
          <CardDescription>Select a class, student, and a single exam to begin grading.</CardDescription>
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
                  {isFetchingStudents ? <SelectItem value="-" disabled>Loading...</SelectItem> :
                  studentsInSelectedClass.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examSelect">3. Select Exam</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!selectedClassId || relevantExams.length === 0}>
                <SelectTrigger id="examSelect"><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                <SelectContent>
                  {relevantExams.map(exam => (<SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(isFetchingStudents || isFetchingScore) && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Loading...</div>}

          {selectedClassId && selectedStudentId && selectedExamId && !isFetchingScore && !isFetchingStudents && (
            <form onSubmit={handleSaveScore} className="mt-6 border-t pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Enter Score for: {studentsInSelectedClass.find(s => s.id === selectedStudentId)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Exam: {selectedExamDetails?.name}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <Label>Score</Label>
                  <Input 
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="Enter score"
                    type="number"
                    max={selectedExamDetails?.max_marks || 100}
                    min="0"
                  />
                </div>
                 <div>
                    <Label>Max Marks</Label>
                    <Input value={selectedExamDetails?.max_marks || 100} readOnly disabled />
                </div>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save Score
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
