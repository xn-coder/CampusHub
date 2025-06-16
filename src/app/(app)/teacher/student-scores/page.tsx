"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, Exam, Subject, StudentScore } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Award, Save, Users, FileText, Loader2 } from 'lucide-react';
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null); // Teacher Profile ID
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

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
      setIsLoading(true);
      supabase.from('students').select('*').eq('class_id', selectedClassId).eq('school_id', currentSchoolId)
        .then(({ data, error }) => {
          if (error) toast({ title: "Error fetching students for class", variant: "destructive" });
          else setStudentsInSelectedClass(data || []);
          setScores({}); 
          setSelectedExamId(''); 
          setIsLoading(false);
        });
    } else {
      setStudentsInSelectedClass([]);
      setScores({});
      setSelectedExamId('');
    }
  }, [selectedClassId, currentSchoolId, toast]);

  useEffect(() => { 
    if (selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && currentSchoolId) {
      setIsLoading(true);
      supabase.from('student_scores')
        .select('student_id, score')
        .eq('exam_id', selectedExamId)
        .eq('class_id', selectedClassId)
        .eq('school_id', currentSchoolId)
        .in('student_id', studentsInSelectedClass.map(s => s.id))
        .then(({ data, error }) => {
          if (error) {
            toast({ title: "Error fetching existing scores", variant: "destructive" });
          } else {
            const newScores: Record<string, string | number> = {};
            (data || []).forEach(ss => { newScores[ss.student_id] = ss.score; });
            // Initialize scores for students who don't have one yet, to ensure inputs appear for all
            studentsInSelectedClass.forEach(student => {
                if (!newScores.hasOwnProperty(student.id)) {
                    newScores[student.id] = ''; // Or some other default like undefined if preferred
                }
            });
            setScores(newScores);
          }
          setIsLoading(false);
        });
    } else if (studentsInSelectedClass.length > 0) {
        // If exam is deselected or class changes but students are present, clear scores for those students or init to empty
        const initialScores: Record<string, string | number> = {};
        studentsInSelectedClass.forEach(student => {
            initialScores[student.id] = '';
        });
        setScores(initialScores);
    } else {
        setScores({}); // Reset scores if exam or class is not selected, or no students
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, selectedClassId, studentsInSelectedClass, currentSchoolId, toast]); // Changed studentsInSelectedClass.length to studentsInSelectedClass


  const handleScoreChange = (studentId: string, value: string) => {
    setScores(prev => ({ ...prev, [studentId]: value }));
  };
  
  const getSubjectName = (subjectId: string) => allSubjects.find(s => s.id === subjectId)?.name || 'N/A';

  const filteredExamsForSelectedClass = selectedClassId 
    ? allExams.filter(exam => exam.class_id === selectedClassId || !exam.class_id)
    : [];
  
  const selectedExamDetails = allExams.find(ex => ex.id === selectedExamId);

  const handleSaveScores = async () => {
    if (!selectedClassId || !selectedExamId || !currentTeacherId || !selectedExamDetails || !currentSchoolId) {
      toast({ title: "Error", description: "Class, exam, teacher, and school context are required.", variant: "destructive"});
      return;
    }
    setIsLoading(true);

    const scoresToSave = studentsInSelectedClass
      .filter(student => scores[student.id] !== undefined && String(scores[student.id]).trim() !== '')
      .map(student => ({
        student_id: student.id,
        exam_id: selectedExamId,
        subject_id: selectedExamDetails.subject_id,
        class_id: selectedClassId,
        score: scores[student.id],
        max_marks: selectedExamDetails.max_marks,
        recorded_by_teacher_id: currentTeacherId,
        school_id: currentSchoolId,
      }));

    if (scoresToSave.length === 0) {
        toast({ title: "No Scores Entered", description: "Please enter scores before saving.", variant: "default"});
        setIsLoading(false);
        return;
    }

    const result = await saveStudentScoresAction(scoresToSave);
    toast({ title: result.ok ? "Success" : "Error", description: result.message, variant: result.ok ? "default" : "destructive" });
    setIsLoading(false);
  };

  const [studentsWithScores, studentsWithoutScores] = useMemo(() => {
    if (!selectedExamId || studentsInSelectedClass.length === 0) {
        return [[], []];
    }
    const withScores: Student[] = [];
    const withoutScores: Student[] = [];
    studentsInSelectedClass.forEach(student => {
        // Check if score exists AND is not an empty string
        if (scores[student.id] !== undefined && String(scores[student.id]).trim() !== '') {
            withScores.push(student);
        } else {
            withoutScores.push(student);
        }
    });
    return [withScores, withoutScores];
  }, [studentsInSelectedClass, scores, selectedExamId]);


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

  const renderStudentScoreRows = (studentList: Student[]) => {
    return studentList.map(student => (
      <TableRow key={student.id}>
        <TableCell className="font-medium">{student.name}</TableCell>
        <TableCell>
          <Input 
            type="text"
            value={scores[student.id] || ''}
            onChange={(e) => handleScoreChange(student.id, e.target.value)}
            placeholder={selectedExamDetails?.max_marks ? `Score / ${selectedExamDetails.max_marks}` : "Enter score/grade"}
            disabled={isLoading}
          />
        </TableCell>
      </TableRow>
    ));
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
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading}>
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
              <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={isLoading || !selectedClassId || filteredExamsForSelectedClass.length === 0}>
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

          {isLoading && selectedClassId && selectedExamId && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}

          {!isLoading && selectedClassId && selectedExamId && studentsInSelectedClass.length === 0 && (
             <p className="text-muted-foreground text-center py-4">No students found in the selected class.</p>
          )}

          {!isLoading && selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">
                Enter Scores for: <span className="font-semibold">{selectedExamDetails?.name}</span> (Subject: {selectedExamDetails ? getSubjectName(selectedExamDetails.subject_id) : 'N/A'})
                {selectedExamDetails?.max_marks && <span className="text-sm text-muted-foreground"> - Max Marks: {selectedExamDetails.max_marks}</span>}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Users className="inline-block mr-1 h-4 w-4"/>Student Name</TableHead>
                    <TableHead className="w-1/3"><FileText className="inline-block mr-1 h-4 w-4"/>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsWithScores.length > 0 && (
                    <>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={2} className="py-2 px-4 text-sm font-semibold text-muted-foreground">
                          Students with Existing Scores ({studentsWithScores.length})
                        </TableCell>
                      </TableRow>
                      {renderStudentScoreRows(studentsWithScores)}
                    </>
                  )}
                  {studentsWithoutScores.length > 0 && (
                    <>
                       <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={2} className="py-2 px-4 text-sm font-semibold text-muted-foreground">
                          Students Needing Scores ({studentsWithoutScores.length})
                        </TableCell>
                      </TableRow>
                      {renderStudentScoreRows(studentsWithoutScores)}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!isLoading && selectedClassId && selectedExamId && studentsInSelectedClass.length > 0 && (
          <CardFooter>
            <Button onClick={handleSaveScores} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> :<Save className="mr-2 h-4 w-4" />} Save Scores
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

