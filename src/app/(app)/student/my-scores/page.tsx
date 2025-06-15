
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { StudentScore, Exam, Subject } from '@/types';
import { useState, useEffect } from 'react';
import { Award, BookOpen, CalendarCheck, FileText, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

export default function StudentMyScoresPage() {
  const [myScores, setMyScores] = useState<StudentScore[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null); // This will be Student Profile ID
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  useEffect(() => {
    const studentUserId = localStorage.getItem('currentUserId');
    if (studentUserId) {
      // First, get student's profile ID and school ID from their user ID
      supabase.from('students').select('id, school_id').eq('user_id', studentUserId).single()
        .then(({data: studentProfile, error: profileError}) => {
          if (profileError || !studentProfile) {
            console.error("Error fetching student profile:", profileError);
            setIsLoading(false); return;
          }
          setCurrentStudentId(studentProfile.id);
          setCurrentSchoolId(studentProfile.school_id);

          // Now fetch scores and related data for this student and school
          if (studentProfile.id && studentProfile.school_id) {
            Promise.all([
              supabase.from('student_scores').select('*').eq('student_id', studentProfile.id).eq('school_id', studentProfile.school_id).order('date_recorded', { ascending: false }),
              supabase.from('exams').select('*').eq('school_id', studentProfile.school_id),
              supabase.from('subjects').select('*').eq('school_id', studentProfile.school_id)
            ]).then(([scoresRes, examsRes, subjectsRes]) => {
              if (scoresRes.error) console.error("Error fetching scores", scoresRes.error);
              else setMyScores((scoresRes.data as StudentScore[]) || []);

              if (examsRes.error) console.error("Error fetching exams", examsRes.error);
              else setAllExams((examsRes.data as Exam[]) || []);
              
              if (subjectsRes.error) console.error("Error fetching subjects", subjectsRes.error);
              else setAllSubjects((subjectsRes.data as Subject[]) || []);
              
              setIsLoading(false);
            }).catch(err => {
                console.error("Error fetching student score data:", err);
                setIsLoading(false);
            });
          } else {
              setIsLoading(false); // No school ID or student profile ID
          }
        });
    } else {
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
             <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your scores...</div>
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
                    <TableCell className="font-medium">{getExamName(score.exam_id)}</TableCell>
                    <TableCell>{getSubjectName(score.subject_id)}</TableCell>
                    <TableCell className="font-semibold">{String(score.score)}</TableCell>
                    <TableCell>{score.max_marks ?? 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(score.date_recorded), 'PP')}</TableCell>
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

