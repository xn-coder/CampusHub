
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { StudentScore, Exam, Subject, Student } from '@/types';
import { useState, useEffect } from 'react';
import { Award, BookOpen, CalendarCheck, FileText, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export default function StudentMyScoresPage() {
  const { toast } = useToast();
  const [myScores, setMyScores] = useState<StudentScore[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStudentProfileId, setCurrentStudentProfileId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  useEffect(() => {
    async function fetchScoresData() {
      setIsLoading(true);
      const studentUserId = localStorage.getItem('currentUserId');
      if (!studentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive"});
        setIsLoading(false);
        return;
      }

      try {
        const { data: studentProfile, error: profileError } = await supabase
          .from('students')
          .select('id, school_id') // students.id is the student_profile_id
          .eq('user_id', studentUserId)
          .single();

        if (profileError || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
          toast({ title: "Error", description: "Could not fetch student profile or school information.", variant: "destructive"});
          setIsLoading(false);
          return;
        }
        setCurrentStudentProfileId(studentProfile.id);
        setCurrentSchoolId(studentProfile.school_id);

        const [scoresRes, examsRes, subjectsRes] = await Promise.all([
          supabase.from('student_scores').select('*').eq('student_id', studentProfile.id).eq('school_id', studentProfile.school_id).order('date_recorded', { ascending: false }),
          supabase.from('exams').select('*').eq('school_id', studentProfile.school_id),
          supabase.from('subjects').select('*').eq('school_id', studentProfile.school_id)
        ]);

        if (scoresRes.error) throw scoresRes.error;
        setMyScores((scoresRes.data as StudentScore[]) || []);

        if (examsRes.error) throw examsRes.error;
        setAllExams((examsRes.data as Exam[]) || []);
        
        if (subjectsRes.error) throw subjectsRes.error;
        setAllSubjects((subjectsRes.data as Subject[]) || []);
        
      } catch (error: any) {
        toast({ title: "Error", description: `Failed to load score data: ${error.message}`, variant: "destructive"});
      } finally {
        setIsLoading(false);
      }
    }
    fetchScoresData();
  }, [toast]);

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
          ) : !currentStudentProfileId ? (
            <p className="text-destructive text-center py-4">Could not identify student profile. Please log in again.</p>
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
