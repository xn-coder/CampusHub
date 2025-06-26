
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Users, Search, Loader2, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getAdminAttendancePageDataAction, fetchAttendanceForReportAction } from './actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceSummary {
  studentId: string;
  studentName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
}

const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];
const months = [
    { value: 'all', label: 'All Year' }, { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' }, { value: '5', label: 'May' },
    { value: '6', label: 'June' }, { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' }, { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

export default function AdminAttendancePage() {
  const { toast } = useToast();
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allYearlyRecords, setAllYearlyRecords] = useState<Pick<AttendanceRecord, 'student_id' | 'status' | 'date'>[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      loadInitialData(adminUserId);
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoadingPage(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData(adminUserId: string) {
    setIsLoadingPage(true);
    const result = await getAdminAttendancePageDataAction(adminUserId);
    if (result.ok) {
      setCurrentSchoolId(result.schoolId || null);
      setAllClasses(result.classes || []);
      setAllStudents(result.students || []);
    } else {
      toast({ title: "Error loading initial data", description: result.message, variant: "destructive" });
    }
    setIsLoadingPage(false);
  }
  
  const handleSearchAttendance = async () => {
    if (!selectedClassId || !selectedYear || !currentSchoolId) {
      toast({title: "Error", description: "Please select a class and year.", variant: "destructive"});
      return;
    }
    setIsLoadingReport(true);
    setSearchAttempted(true);
    
    const result = await fetchAttendanceForReportAction(currentSchoolId, selectedClassId, selectedYear);
    if (result.ok && result.records) {
        setAllYearlyRecords(result.records);
    } else {
        toast({title: "Error Fetching Report Data", description: result.message, variant: "destructive"});
        setAllYearlyRecords([]);
    }
    setIsLoadingReport(false);
  };
  
  useEffect(() => {
    if (allYearlyRecords.length > 0 || searchAttempted) {
        const studentsInClass = allStudents.filter(s => s.class_id === selectedClassId);
        let recordsForPeriod = allYearlyRecords;
        if(selectedMonth !== 'all') {
            recordsForPeriod = allYearlyRecords.filter(r => {
                const recordDate = new Date(r.date);
                return recordDate.getMonth() + 1 === Number(selectedMonth);
            });
        }
        
        const summary = studentsInClass.map(student => {
            const studentRecords = recordsForPeriod.filter(r => r.student_id === student.id);
            const present = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
            const absent = studentRecords.filter(r => r.status === 'Absent').length;
            const total = studentRecords.length;
            const percentage = total > 0 ? (present / total) * 100 : 0;

            return {
                studentId: student.id,
                studentName: student.name,
                present,
                absent,
                late: studentRecords.filter(r => r.status === 'Late').length,
                excused: studentRecords.filter(r => r.status === 'Excused').length,
                total,
                percentage
            };
        });
        setAttendanceSummary(summary);
    }
  }, [allYearlyRecords, selectedMonth, selectedClassId, allStudents, searchAttempted]);

  const handleDownloadPdf = () => {
    if (attendanceSummary.length === 0) {
      toast({ title: "No data to download", variant: "destructive"});
      return;
    }
    const doc = new jsPDF();
    const selectedClass = allClasses.find(c => c.id === selectedClassId);
    const monthLabel = months.find(m => m.value === selectedMonth)?.label;
    const title = `Attendance Report for ${selectedClass?.name} - ${selectedClass?.division}`;
    const subtitle = `${monthLabel}, ${selectedYear}`;

    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(12);
    doc.text(subtitle, 14, 30);
    
    autoTable(doc, {
        startY: 35,
        head: [['Student Name', 'Present Days', 'Absent Days', 'Attendance %']],
        body: attendanceSummary.map(s => [
            s.studentName,
            s.present,
            s.absent,
            `${s.percentage.toFixed(2)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`Attendance_${selectedClass?.name}_${monthLabel}_${selectedYear}.pdf`);
  };

  const selectedClassDetails = allClasses.find(c => c.id === selectedClassId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="View Attendance Reports" 
        description="Generate and download monthly or yearly attendance reports for your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Attendance Report Generator</CardTitle>
          <CardDescription>Select a class, year, and month to generate an attendance summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingPage || !currentSchoolId}>
                <SelectTrigger id="classSelect"><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>{allClasses.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>)}</SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="yearSelect">Select Year</Label>
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))} disabled={isLoadingPage || !currentSchoolId}>
                <SelectTrigger id="yearSelect"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="monthSelect">Select Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isLoadingPage || !currentSchoolId}>
                <SelectTrigger id="monthSelect"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleSearchAttendance} disabled={isLoadingPage || isLoadingReport || !selectedClassId} className="w-full">
                    {isLoadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />} Search
                </Button>
                <Button onClick={handleDownloadPdf} disabled={isLoadingReport || attendanceSummary.length === 0} variant="outline" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Download
                </Button>
            </div>
          </div>
          
          {!isLoadingPage && !currentSchoolId && (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view attendance.</p>
          )}

          {isLoadingReport && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading attendance report...</div>}

          {!isLoadingReport && searchAttempted && (
            <div className="overflow-x-auto">
              <h3 className="text-lg font-medium my-2">Attendance Summary</h3>
              {attendanceSummary.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><Users className="inline-block mr-1 h-4 w-4" />Student Name</TableHead>
                        <TableHead className="text-center">Present Days</TableHead>
                        <TableHead className="text-center">Absent Days</TableHead>
                        <TableHead className="text-center">Attendance %</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {attendanceSummary.map(record => (
                        <TableRow key={record.studentId}>
                        <TableCell className="font-medium">{record.studentName}</TableCell>
                        <TableCell className="text-center">{record.present}</TableCell>
                        <TableCell className="text-center">{record.absent}</TableCell>
                        <TableCell className="text-center font-semibold">{record.percentage.toFixed(2)}%</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance records found for the selected period.</p>
              )}
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Select a class and time period, then click 'Search' to generate the report.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
    
