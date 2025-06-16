
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExamWithStudentScore } from '@/types';
import { useState, useEffect } from 'react';
import { Award, BookOpen, CalendarCheck, FileText, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getStudentScoresAndExamsAction } from './actions';

export default function StudentMyScoresPage() {
  const { toast } = useToast();
  const [examsWithScores, setExamsWithScores] = useState<ExamWithStudentScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScoresAndExamsData() {
      setIsLoading(true);
      setPageMessage(null);
      const studentUserId = localStorage.getItem('currentUserId');
      if (!studentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive"});
        setPageMessage("User not identified. Please log in again.");
        setIsLoading(false);
        return;
      }

      const result = await getStudentScoresAndExamsAction(studentUserId);

      if (result.ok && result.examsWithScores) {
        setExamsWithScores(result.examsWithScores);
        if (result.examsWithScores.length === 0 && result.studentProfileId) {
          setPageMessage("No exams found for your school yet, or no scores recorded.");
        }
      } else {
        toast({ title: "Error Loading Scores & Exams", description: result.message, variant: "destructive" });
        setExamsWithScores([]);
        setPageMessage(result.message || "Failed to load score and exam data.");
      }
      setIsLoading(false);
    }
    fetchScoresAndExamsData();
  }, [toast]);

  const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Scores & Grades" 
        description="View your academic performance across various exams." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" /> My Examination Results</CardTitle>
          <CardDescription>A record of your scores and exam participation.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your results...</div>
          ) : pageMessage ? (
            <p className="text-muted-foreground text-center py-4">{pageMessage}</p>
          ) : examsWithScores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No exams or scores are currently available for you.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><FileText className="inline-block mr-1 h-4 w-4"/>Exam Name</TableHead>
                  <TableHead><BookOpen className="inline-block mr-1 h-4 w-4"/>Subject</TableHead>
                  <TableHead>Exam Date</TableHead>
                  <TableHead>Score / Max Marks</TableHead>
                  <TableHead><CalendarCheck className="inline-block mr-1 h-4 w-4"/>Date Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examsWithScores.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.name}</TableCell>
                    <TableCell>{exam.subjectName || 'N/A'}</TableCell>
                    <TableCell>{formatDateSafe(exam.date)}</TableCell>
                    <TableCell className="font-semibold">
                      {exam.studentScore && exam.studentScore.score !== null ? (
                        `${exam.studentScore.score} / ${exam.studentScore.max_marks ?? exam.max_marks ?? 'N/A'}`
                      ) : (
                        <span className="text-muted-foreground">Result Not Declared</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {exam.studentScore && exam.studentScore.date_recorded 
                        ? formatDateSafe(exam.studentScore.date_recorded) 
                        : 'N/A'}
                    </TableCell>
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
