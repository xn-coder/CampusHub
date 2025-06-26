
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
import { parseISO } from 'date-fns';
import { 
  getTeacherStudentScoresPageInitialDataAction, 
  getStudentsForClassAction, 
  getScoresForExamAndStudentAction,
  saveStudentScoresAction 
} from './actions';

interface ExamGroup {
  id: string; // Composite key for the select, e.g., "Mid Term|2024-10-26|class-id"
  name: string; // Clean name, e.g., "Mid Term"
  displayName: string; // Formatted for dropdown, e.g., "Mid Term (Class 1 - A)"
  date: string;
  classId: string | null;
  exams: Exam[]; // The individual exam records making up this group
}

export default function TeacherStudentScoresPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedExamGroupId, setSelectedExamGroupId] = useState<string>('');
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
    setSelectedExamGroupId('');         
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
  
  const examGroups = useMemo(() => {
    const groups: Record<string, ExamGroup> = {};
    const relevantExams = allExams.filter(exam => exam.class_id === selectedClassId);

    relevantExams.forEach(exam => {
      const namePrefix = exam.name.split(' - ')[0].trim();
      const key = `${namePrefix}|${exam.date}|${exam.class_id || 'global'}`;

      if (!groups[key]) {
        const className = assignedClasses.find(c => c.id === exam.class_id)?.name || 'General';
        const divisionName = assignedClasses.find(c => c.id === exam.class_id)?.division;
        const classDisplay = exam.class_id ? `${className} - ${divisionName}` : 'All Classes';
        
        groups[key] = {
          id: key,
          name: namePrefix,
          displayName: `${namePrefix} (${classDisplay})`,
          date: exam.date,
          classId: exam.class_id,
          exams: [],
        };
      }
      groups[key].exams.push(exam);
    });
    return Object.values(groups).sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [allExams, assignedClasses, selectedClassId]);

  const selectedExamGroup = useMemo(() => {
    return examGroups.find(g => g.id === selectedExamGroupId);
  }, [selectedExamGroupId, examGroups]);


  const fetchScores = useCallback(async () => {
    if (selectedStudentId && selectedExamGroup && currentSchoolId) {
      setIsFetchingScores(true);
      const examIds = selectedExamGroup.exams.map(e => e.id);

      const { data: fetchedScoresData, error } = await getScoresForExamAndStudentAction(examIds[0], selectedStudentId, currentSchoolId);

      const scoresMap: Record<string, string | number> = {};
      
      if (error) {
        toast({ title: "Error fetching existing scores", description: error, variant: "destructive" });
        setScores({});
      } else if (fetchedScoresData) {
        // Since we are now fetching scores for one exam of the group, we need to adapt
        // This part needs a rethink. The action should probably fetch for ALL exams in the group
        const { data: allScoresForStudent, error: allScoresError } = await supabase
            .from('student_scores')
            .select('subject_id, score')
            .eq('student_id', selectedStudentId)
            .in('exam_id', examIds)
            .eq('school_id', currentSchoolId);
        
        if (allScoresError) {
          toast({ title: "Error fetching all scores for student", description: allScoresError.message, variant: "destructive"});
        } else {
            (allScoresForStudent || []).forEach(s => {
                scoresMap[s.subject_id] = s.score;
            });
        }
        setScores(scoresMap);
      }
      
      setIsFetchingScores(false);
    }
  }, [selectedStudentId, selectedExamGroup, currentSchoolId, toast]);

  useEffect(() => {
    if (selectedStudentId && selectedExamGroup) {
      fetchScores();
    } else {
      setScores({});
    }
  }, [selectedStudentId, selectedExamGroup, fetchScores]);


  const handleScoreChange = (subjectId: string, value: string) => {
    setScores(prev => ({ ...prev, [subjectId]: value }));
  };

  const handleSaveScores = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedExamGroup || !selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Required context (Class, Student, Exam) is missing.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    const scoresToSave = selectedExamGroup.exams
      .filter(exam => scores[exam.subject_id] !== undefined && String(scores[exam.subject_id]).trim() !== '')
      .map(exam => ({
        student_id: selectedStudentId,
        exam_id: exam.id, // The specific exam ID for this subject from the group
        subject_id: exam.subject_id,
        class_id: selectedClassId,
        score: scores[exam.subject_id],
        max_marks: exam.max_marks,
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
        description="Select a class, student, and exam event to input scores for the relevant subjects." 
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
                  {isFetchingStudents ? <SelectItem value="-" disabled>Loading...</SelectItem> :
                  studentsInSelectedClass.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examSelect">3. Select Exam Event</Label>
              <Select value={selectedExamGroupId} onValueChange={setSelectedExamGroupId} disabled={!selectedStudentId || examGroups.length === 0}>
                <SelectTrigger id="examSelect"><SelectValue placeholder="Choose an exam event" /></SelectTrigger>
                <SelectContent>
                  {examGroups.map(group => (<SelectItem key={group.id} value={group.id}>{group.displayName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {(isFetchingStudents || isFetchingScores) && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Loading...</div>}

          {selectedClassId && selectedStudentId && selectedExamGroupId && !isFetchingScores && !isFetchingStudents && (
            <form onSubmit={handleSaveScores} className="mt-6 border-t pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium">
                  Enter Scores for: {studentsInSelectedClass.find(s => s.id === selectedStudentId)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Exam: {selectedExamGroup?.name}
                </p>
              </div>
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
                    {selectedExamGroup?.exams.map(exam => {
                      const subject = allSubjects.find(s => s.id === exam.subject_id);
                      if (!subject) return null;
                      return (
                      <TableRow key={subject.id}>
                        <TableCell>{subject.name}</TableCell>
                        <TableCell>
                          <Input 
                            value={scores[subject.id] || ''}
                            onChange={(e) => handleScoreChange(subject.id, e.target.value)}
                            placeholder="Enter score"
                            type="number"
                          />
                        </TableCell>
                        <TableCell>{exam.max_marks || 100}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button type="submit" className="mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Scores
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
