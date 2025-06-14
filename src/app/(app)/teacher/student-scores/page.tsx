
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, Exam, Subject, StudentScore } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, BookOpenText, Users, FileText } from 'lucide-react';
import { format } from 'date-fns';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_EXAMS_KEY = 'mockExamsData';
const MOCK_SUBJECTS_KEY = 'mockSubjectsData';
const MOCK_STUDENT_SCORES_KEY = 'mockStudentScoresData';

export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, string | number>>({}); // studentId: score
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const allClasses: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
      setAssignedClasses(teacherId ? allClasses.filter(c => c.teacherId === teacherId) : []);

      const storedExams = localStorage.getItem(MOCK_EXAMS_KEY);
      setAllExams(storedExams ? JSON.parse(storedExams) : []);
      
      const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
      setAllSubjects(storedSubjects ? JSON.parse(storedSubjects) : []);
      
      if (!localStorage.getItem(MOCK_STUDENT_SCORES_KEY)) {
        localStorage.setItem(MOCK_STUDENT_SCORES_KEY, JSON.stringify([]));
      }
    }
  }, []);

  useEffect(() => { // Load students when class changes
    if (selectedClassId) {
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      const allStudents: Student[] = storedStudents ? JSON.parse(storedStudents) : [];
      setStudentsInSelectedClass(allStudents.filter(s => s.classId === selectedClassId));
      setScores({}); // Reset scores when class changes
      setSelectedExamId(''); // Reset exam selection
    } else {
      setStudentsInSelectedClass([]);
      setScores({});
      setSelectedExamId('');
    }
  }, [selectedClassId]);

  useEffect(() => { // Load existing scores when exam changes
    if (selectedClassId && selectedExamId && studentsInSelectedClass.length > 0) {
      const storedStudentScores: StudentScore[] = JSON.parse(localStorage.getItem(MOCK_STUDENT_SCORES_KEY) || '[]');
      const newScores: Record<string, string | number> = {};
      studentsInSelectedClass.forEach(student => {
        const existingScore = storedStudentScores.find(
          ss => ss.studentId === student.id && ss.examId === selectedExamId && ss.classSectionId === selectedClassId
        );
        if (existingScore) {
          newScores[student.id] = existingScore.score;
        }
      });
      setScores(newScores);
    } else {
        setScores({});
    }
  }, [selectedExamId, selectedClassId, studentsInSelectedClass]);


  const handleScoreChange = (studentId: string, value: string) => {
    setScores(prev => ({ ...prev, [studentId]: value }));
  };
  
  const getSubjectName = (subjectId: string) => allSubjects.find(s => s.id === subjectId)?.name || 'N/A';

  const filteredExamsForSelectedClass = selectedClassId 
    ? allExams.filter(exam => exam.classSectionId === selectedClassId || !exam.classSectionId) // Show exams for this class OR general exams
    : [];
  
  const selectedExamDetails = allExams.find(ex => ex.id === selectedExamId);

  const handleSaveScores = () => {
    if (!selectedClassId || !selectedExamId || !currentTeacherId || !selectedExamDetails) {
      toast({ title: "Error", description: "Please select class and exam.", variant: "destructive"});
      return;
    }

    const storedStudentScores: StudentScore[] = JSON.parse(localStorage.getItem(MOCK_STUDENT_SCORES_KEY) || '[]');
    let updatedScoresCount = 0;

    studentsInSelectedClass.forEach(student => {
      const scoreValue = scores[student.id];
      if (scoreValue !== undefined && scoreValue !== '') { // Only save if a score is entered
        const existingScoreIndex = storedStudentScores.findIndex(
          ss => ss.studentId === student.id && ss.examId === selectedExamId && ss.classSectionId === selectedClassId
        );

        const scoreRecord: StudentScore = {
          id: existingScoreIndex > -1 ? storedStudentScores[existingScoreIndex].id : `score-${Date.now()}-${student.id}`,
          studentId: student.id,
          examId: selectedExamId,
          subjectId: selectedExamDetails.subjectId,
          classSectionId: selectedClassId,
          score: typeof scoreValue === 'string' && !isNaN(parseFloat(scoreValue)) ? parseFloat(scoreValue) : scoreValue, // Convert to number if possible
          maxMarks: selectedExamDetails.maxMarks,
          recordedByTeacherId: currentTeacherId,
          dateRecorded: new Date().toISOString(),
        };

        if (existingScoreIndex > -1) {
          storedStudentScores[existingScoreIndex] = scoreRecord;
        } else {
          storedStudentScores.push(scoreRecord);
        }
        updatedScoresCount++;
      }
    });

    localStorage.setItem(MOCK_STUDENT_SCORES_KEY, JSON.stringify(storedStudentScores));
    if (updatedScoresCount > 0) {
      toast({ title: "Scores Saved", description: `Scores for ${updatedScoresCount} student(s) have been saved/updated for ${selectedExamDetails.name}.`});
    } else {
      toast({ title: "No Scores Entered", description: "No new scores were entered to save.", variant: "default"});
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Gradebook: Enter Student Scores" 
        description="Select a class and exam to input or update student scores." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> Manage Scores</CardTitle>
          <CardDescription>Choose class, then exam, then enter scores for students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
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
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!selectedClassId || filteredExamsForSelectedClass.length === 0}>
                <SelectTrigger id="examSelect">
                  <SelectValue placeholder="Choose an exam" />
                </SelectTrigger>
                <SelectContent>
                  {filteredExamsForSelectedClass.length > 0 ? filteredExamsForSelectedClass.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.name} ({getSubjectName(exam.subjectId)}) - {format(parseISO(exam.date), 'PP')}</SelectItem>
                  )) : <SelectItem value="-" disabled>No exams for this class or no class selected</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedClassId && selectedExamId && studentsInSelectedClass.length === 0 && (
             <p className="text-muted-foreground text-center py-4">No students found in the selected class.</p>
          )}

          {selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">
                Enter Scores for: <span className="font-semibold">{selectedExamDetails?.name}</span> (Subject: {selectedExamDetails ? getSubjectName(selectedExamDetails.subjectId) : 'N/A'})
                {selectedExamDetails?.maxMarks && <span className="text-sm text-muted-foreground"> - Max Marks: {selectedExamDetails.maxMarks}</span>}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Users className="inline-block mr-1 h-4 w-4"/>Student Name</TableHead>
                    <TableHead className="w-1/3"><FileText className="inline-block mr-1 h-4 w-4"/>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInSelectedClass.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <Input 
                          type="text" // Use text to allow for grade strings like "A+" or numeric
                          value={scores[student.id] || ''}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          placeholder={selectedExamDetails?.maxMarks ? `Score / ${selectedExamDetails.maxMarks}` : "Enter score/grade"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && (
          <CardFooter>
            <Button onClick={handleSaveScores} disabled={isLoading}><Save className="mr-2 h-4 w-4" /> Save Scores</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
