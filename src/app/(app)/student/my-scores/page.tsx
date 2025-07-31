
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { ExamWithStudentScore } from '@/types';
import { useState, useEffect } from 'react';
import { Award, BookOpen, CalendarCheck, FileText, Loader2, TrendingUp, Download } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { getStudentScoresAndExamsAction } from './actions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

export default function StudentMyScoresPage() {
  const { toast } = useToast();
  const [reportCards, setReportCards] = useState<ExamWithStudentScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ExamWithStudentScore | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [currentStudentName, setCurrentStudentName] = useState<string>('');


  useEffect(() => {
    async function fetchScoresAndExamsData() {
      setIsLoading(true);
      setPageMessage(null);
      const studentUserId = localStorage.getItem('currentUserId');
      const studentName = localStorage.getItem('currentUserName');
      if (studentName) setCurrentStudentName(studentName);

      if (!studentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive"});
        setPageMessage("User not identified. Please log in again.");
        setIsLoading(false);
        return;
      }

      const result = await getStudentScoresAndExamsAction(studentUserId);

      if (result.ok && result.examsWithScores) {
        setReportCards(result.examsWithScores);
        if (result.examsWithScores.length === 0 && result.studentProfileId) {
          setPageMessage("No exam results have been published yet.");
        }
      } else {
        toast({ title: "Error Loading Scores & Exams", description: result.message, variant: "destructive" });
        setReportCards([]);
        setPageMessage(result.message || "Failed to load score and exam data.");
      }
      setIsLoading(false);
    }
    fetchScoresAndExamsData();
  }, [toast]);

  const handleOpenReportDetails = (report: ExamWithStudentScore) => {
    setSelectedReport(report);
    setIsDetailViewOpen(true);
  };
  
  const handleDownloadReport = async () => {
    if (!selectedReport) return;
    
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF() as JsPDFWithAutoTable;
    const schoolName = "CampusHub High School"; // Mock data
    
    doc.setFontSize(20);
    doc.text(schoolName, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("Student Report Card", doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`Student: ${currentStudentName}`, 14, 40);
    doc.text(`Exam: ${selectedReport.name}`, 14, 46);
    doc.text(`Date: ${formatDateSafe(selectedReport.date)}`, doc.internal.pageSize.getWidth() - 14, 46, { align: 'right' });
    
    const tableColumn = ["Subject", "Score", "Max Marks", "Result"];
    const tableRows = (selectedReport.studentScores || []).map(score => {
        const maxMarks = score.max_marks ?? 100;
        const isPass = Number(score.score) >= maxMarks * 0.4;
        return [
            score.subjectName,
            String(score.score),
            maxMarks,
            isPass ? 'Pass' : 'Fail'
        ];
    });

    autoTable(doc, {
        startY: 52,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    
    doc.setFontSize(12);
    doc.text("Overall Summary", 14, finalY + 15);
    doc.setFontSize(10);
    doc.line(14, finalY + 16, doc.internal.pageSize.getWidth() - 14, finalY + 16);
    
    const summaryX = 16;
    let summaryY = finalY + 22;
    doc.text(`Total Marks Obtained: ${selectedReport.overallResult?.totalMarks} / ${selectedReport.overallResult?.maxMarks}`, summaryX, summaryY);
    summaryY += 6;
    doc.text(`Percentage: ${selectedReport.overallResult?.percentage.toFixed(2)}%`, summaryX, summaryY);
    summaryY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Final Result: ${selectedReport.overallResult?.status}`, summaryX, summaryY);

    const signatureY = doc.internal.pageSize.getHeight() - 30;
    doc.line(14, signatureY, 70, signatureY);
    doc.text("Principal's Signature", 14, signatureY + 5);

    doc.save(`Report_Card_${selectedReport.name.replace(/\s+/g, '_')}_${currentStudentName.replace(/\s/g, '_')}.pdf`);

    toast({
        title: "Download Started",
        description: "Your payment history PDF is being downloaded."
    });
  };

  const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Report Cards" 
        description="View your academic performance and results for each examination term." 
      />
      {isLoading ? (
         <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your results...</CardContent></Card>
      ) : pageMessage ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">{pageMessage}</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportCards.map(report => (
                <Card key={report.id} className="flex flex-col">
                    <CardHeader>
                        <CardTitle>{report.name}</CardTitle>
                        <CardDescription>Exam Date: {formatDateSafe(report.date)}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Overall Percentage</p>
                            <p className="text-4xl font-bold text-primary">{report.overallResult?.percentage.toFixed(2) ?? 'N/A'}%</p>
                        </div>
                        <Progress value={report.overallResult?.percentage ?? 0} className="h-2"/>
                        <div className="text-center font-bold text-lg">
                           {report.overallResult?.status === 'Pass' ? (
                                <span className="text-green-600">Pass</span>
                            ) : (
                                <span className="text-destructive">Fail</span>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => handleOpenReportDetails(report)} className="w-full">
                            View Detailed Report
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      )}

      {selectedReport && (
        <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detailed Report: {selectedReport.name}</DialogTitle>
              <DialogDescription>
                Exam Date: {formatDateSafe(selectedReport.date)}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto pr-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Max Marks</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReport.studentScores?.map(score => {
                    const maxMarks = score.max_marks ?? 100;
                    const isPass = Number(score.score) >= maxMarks * 0.4;
                    return (
                        <TableRow key={score.subject_id}>
                        <TableCell className="font-medium">{score.subjectName}</TableCell>
                        <TableCell className="text-right">{String(score.score)}</TableCell>
                        <TableCell className="text-right">{maxMarks}</TableCell>
                        <TableCell className={`text-right font-semibold ${isPass ? 'text-green-600' : 'text-destructive'}`}>
                            {isPass ? 'Pass' : 'Fail'}
                        </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-bold text-lg">Overall Summary</h4>
                <div className="flex justify-between items-center mt-2">
                    <span>Total Marks:</span>
                    <span className="font-semibold">{selectedReport.overallResult?.totalMarks} / {selectedReport.overallResult?.maxMarks}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span>Percentage:</span>
                    <span className="font-semibold">{selectedReport.overallResult?.percentage.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center mt-1 text-xl">
                    <span>Final Result:</span>
                     <span className={`font-bold ${selectedReport.overallResult?.status === 'Pass' ? 'text-green-600' : 'text-destructive'}`}>
                        {selectedReport.overallResult?.status}
                     </span>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="secondary" onClick={handleDownloadReport}>
                <Download className="mr-2 h-4 w-4"/> Download Report
              </Button>
              <DialogClose asChild><Button>Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
