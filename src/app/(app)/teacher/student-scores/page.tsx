"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student, Exam, Subject, GradebookEntry } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, Users, FileText, Loader2, Edit2 } from 'lucide-react';
import { getTeacherGradebookInitialDataAction, getGradebookDataAction, saveGradebookScoresAction } from './actions';

export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  // Initial data from server
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  // User selections
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>(''); // This will be the ID of the first exam in a group to identify it

  // Data for the gradebook table
  const [students, setStudents] = useState<Student[]>([]);
  const [examSubjects, setExamSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Record<string, GradebookEntry>>({}); // Key: `studentId-subjectId`

  // Loading states
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [isFetchingGradebook, setIsFetchingGradebook] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // User context
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsFetchingInitialData(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
      setIsFetchingInitialData(false);
      return;
    }
    const result = await getTeacherGradebookInitialDataAction(teacherUserId);
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

  const handleFetchGradebook = useCallback(async () => {
    if (!selectedClassId || !selectedExamId || !currentSchoolId) return;

    setIsFetchingGradebook(true);
    setStudents([]);
    setExamSubjects([]);
    setScores({});

    const result = await getGradebookDataAction(selectedClassId, selectedExamId, currentSchoolId, allExams, allSubjects);
    if (result.ok) {
      setStudents(result.students || []);
      setExamSubjects(result.subjects || []);
      setScores(result.scores || {});
    } else {
      toast({ title: "Error fetching gradebook", description: result.message, variant: "destructive" });
    }
    setIsFetchingGradebook(false);
  }, [selectedClassId, selectedExamId, currentSchoolId, allExams, allSubjects, toast]);

  const handleScoreChange = (studentId: string, subjectId: string, value: string) => {
    const key = `${studentId}-${subjectId}`;
    setScores(prev => ({
      ...prev,
      [key]: { ...prev[key], score: value }
    }));
  };

  const handleSaveAllGrades = async () => {
    if (!currentTeacherId || !currentSchoolId || students.length === 0 || examSubjects.length === 0) {
      toast({ title: "Error", description: "Missing required context or data to save grades.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    
    // Flatten the scores map into an array of records to save
    const recordsToSave = Object.entries(scores)
        .map(([key, entry]) => ({ ...entry }))
        .filter(entry => entry.score !== undefined && entry.score !== null && String(entry.score).trim() !== ''); // Only save non-empty scores

    const result = await saveGradebookScoresAction(recordsToSave, currentTeacherId, currentSchoolId);

    if (result.ok) {
      toast({ title: "Success", description: result.message });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSaving(false);
  };
  
  const groupedExams = useMemo(() => {
    const examMap: Record<string, Exam> = {};
    allExams.forEach(exam => {
        if (!exam.class_id || exam.class_id === selectedClassId) {
            const groupKey = `${exam.name.split(' - ')[0]}_${exam.date}_${exam.class_id || 'global'}`;
            if (!examMap[groupKey]) {
                examMap[groupKey] = exam; // Store the first exam of the group as the representative
            }
        }
    });
    return Object.values(examMap);
  }, [allExams, selectedClassId]);

  const selectedExamDetails = allExams.find(e => e.id === selectedExamId);

  if (isFetchingInitialData) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading initial data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Gradebook" />
        <Card><CardContent className="pt-6 text-center text-destructive">Could not load teacher profile. Please ensure your account is set up by an admin.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Gradebook: Enter Student Scores" 
        description="Select a class and exam event to load the grade sheet for all students and subjects." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> Score Entry</CardTitle>
          <CardDescription>Select a class and exam to begin grading. Scores for all subjects registered in the school are listed below for the selected exam.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">1. Select Class</Label>
              <Select value={selectedClassId} onValueChange={(value) => { setSelectedClassId(value); setSelectedExamId(''); setStudents([]); setExamSubjects([]); setScores({}); }} disabled={assignedClasses.length === 0}>
                <SelectTrigger id="classSelect"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {assignedClasses.map(cls => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examSelect">2. Select Exam Event</Label>
              <Select value={selectedExamId} onValueChange={(value) => { setSelectedExamId(value); setStudents([]); setExamSubjects([]); setScores({}); }} disabled={!selectedClassId || groupedExams.length === 0}>
                <SelectTrigger id="examSelect"><SelectValue placeholder="Choose an exam event" /></SelectTrigger>
                <SelectContent>
                  {groupedExams.map(exam => (<SelectItem key={exam.id} value={exam.id}>{exam.name.split(' - ')[0]} ({exam.date})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleFetchGradebook} disabled={!selectedClassId || !selectedExamId || isFetchingGradebook}>
              {isFetchingGradebook ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>} Load Grade Sheet
            </Button>
          </div>

          {isFetchingGradebook && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Loading grade sheet...</div>}

          {!isFetchingGradebook && students.length > 0 && examSubjects.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-2">Grade Sheet for {selectedExamDetails?.name.split(' - ')[0]}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Student Name</TableHead>
                      {examSubjects.map(subject => (
                        <TableHead key={subject.id} className="text-center">
                          {subject.name} <br/> (Max: {allExams.find(e => e.subject_id === subject.id && e.name.startsWith(selectedExamDetails?.name.split(' - ')[0] || ''))?.max_marks || 100})
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium sticky left-0 bg-background z-10">{student.name}</TableCell>
                        {examSubjects.map(subject => {
                          const key = `${student.id}-${subject.id}`;
                          const maxMarks = scores[key]?.max_marks || 100;
                          return (
                            <TableCell key={subject.id} className="min-w-[100px]">
                              <Input
                                type="number"
                                placeholder="Score"
                                value={scores[key]?.score ?? ''}
                                onChange={(e) => handleScoreChange(student.id, subject.id, e.target.value)}
                                max={maxMarks}
                                min={0}
                                className="text-center"
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-6 flex justify-end">
                  <Button onClick={handleSaveAllGrades} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                      Save All Grades
                  </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
