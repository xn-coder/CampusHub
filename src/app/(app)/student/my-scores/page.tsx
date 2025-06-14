
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { StudentScore, Exam, Subject } from '@/types';
import { useState, useEffect } from 'react';
import { Award, BookOpen, CalendarCheck, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MOCK_STUDENT_SCORES_KEY = 'mockStudentScoresData';
const MOCK_EXAMS_KEY = 'mockExamsData';
const MOCK_SUBJECTS_KEY = 'mockSubjectsData';

export default function StudentMyScoresPage() {
  const [myScores, setMyScores] = useState<StudentScore[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const studentId = localStorage.getItem('currentUserId');
      setCurrentStudentId(studentId);

      const storedScores = localStorage.getItem(MOCK_STUDENT_SCORES_KEY);
      const allScoresData: StudentScore[] = storedScores ? JSON.parse(storedScores) : [];
      
      if (studentId) {
        const studentSpecificScores = allScoresData
          .filter(score => score.studentId === studentId)
          .sort((a, b) => parseISO(b.dateRecorded).getTime() - parseISO(a.dateRecorded).getTime()); // Newest first
        setMyScores(studentSpecificScores);
      }
      
      const storedExams = localStorage.getItem(MOCK_EXAMS_KEY);
      setAllExams(storedExams ? JSON.parse(storedExams) : []);
      
      const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
      setAllSubjects(storedSubjects ? JSON.parse(storedSubjects) : []);

      setIsLoading(false);
    }
  }, []);

  const getExamName = (examId: string) => allExams.find(e => e.id === examId)?.name || 'N/A';
  const getSubjectName = (subjectId: string) => allSubjects.find(s => s.id === subjectId)?.name || 'N/A';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Scores & Grades" 
        description="View your academic performance across various exams." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> My Examination Results</CardTitle>
          <CardDescription>A record of your scores in different subjects and exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading your scores...</p>
          ) : !currentStudentId ? (
            <p className="text-destructive text-center py-4">Could not identify student. Please log in again.</p>
          ) : myScores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scores have been recorded for you yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><FileText className="inline-block mr-1 h-4 w-4"/>Exam</TableHead>
                  <TableHead><BookOpen className="inline-block mr-1 h-4 w-4"/>Subject</TableHead>
                  <TableHead>Score / Grade</TableHead>
                  <TableHead>Max Marks</TableHead>
                  <TableHead><CalendarCheck className="inline-block mr-1 h-4 w-4"/>Date Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myScores.map((score) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">{getExamName(score.examId)}</TableCell>
                    <TableCell>{getSubjectName(score.subjectId)}</TableCell>
                    <TableCell className="font-semibold">{String(score.score)}</TableCell>
                    <TableCell>{score.maxMarks ?? 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(score.dateRecorded), 'PP')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
