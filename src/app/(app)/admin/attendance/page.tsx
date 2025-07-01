
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Users, Search, Loader2, Download, Calendar as CalendarIcon, UserCheck, UserX, Clock, Ban } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getAdminAttendancePageDataAction, fetchAttendanceForReportAction } from './actions';
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { Calendar } from '@/components/ui/calendar';
import { isValid, parseISO, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}


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
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

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
    setSelectedStudentId(''); // Reset student selection on new search
    
    const result = await fetchAttendanceForReportAction(currentSchoolId, selectedClassId, selectedYear);
    if (result.ok && result.records) {
        setAllYearlyRecords(result.records);
    } else {
        toast({title: "Error Fetching Report Data", description: result.message, variant: "destructive"});
        setAllYearlyRecords([]);
    }
    setIsLoadingReport(false);
  };
  
  const studentsInClass = useMemo(() => {
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [allStudents, selectedClassId]);
  
  useEffect(() => {
    if (allYearlyRecords.length > 0 || (searchAttempted && !isLoadingReport)) {
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
  }, [allYearlyRecords, selectedMonth, studentsInClass, searchAttempted, isLoadingReport]);

  const handleDownloadPdf = async () => {
    if (attendanceSummary.length === 0) {
      toast({ title: "No data to download", variant: "destructive"});
      return;
    }
    
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF() as JsPDFWithAutoTable;
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

  const selectedStudentRecords = useMemo(() => {
    let records = allYearlyRecords.filter(r => r.student_id === selectedStudentId);
    if(selectedMonth !== 'all') {
        records = records.filter(r => new Date(r.date).getMonth() + 1 === Number(selectedMonth));
    }
    return records;
  }, [selectedStudentId, selectedMonth, allYearlyRecords]);

  const calendarModifiers = useMemo(() => {
    const present: Date[] = [];
    const absent: Date[] = [];
    const late: Date[] = [];
    const excused: Date[] = [];
    
    selectedStudentRecords.forEach(record => {
      const date = parseISO(record.date);
      if (isValid(date)) {
        switch(record.status) {
          case 'Present': present.push(date); break;
          case 'Absent': absent.push(date); break;
          case 'Late': late.push(date); break;
          case 'Excused': excused.push(date); break;
        }
      }
    });

    return { present, absent, late, excused };
  }, [selectedStudentRecords]);

  const modifiersClassNames = {
    present: 'rdp-day_present',
    absent: 'rdp-day_absent',
    late: 'rdp-day_late',
    excused: 'rdp-day_excused',
  };

  const selectedClassDetails = allClasses.find(c => c.id === selectedClassId);
  const selectedStudentDetails = allStudents.find(s => s.id === selectedStudentId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="View Attendance Reports" 
        description="Generate and download monthly or yearly attendance reports for your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Attendance Report Generator</CardTitle>
          <CardDescription>Select a class and time period, then optionally select a student to view their detailed calendar.</CardDescription>
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
            </div>
          </div>
          
          {searchAttempted && studentsInClass.length > 0 && (
            <div className="md:col-start-4">
                <Label htmlFor="studentSelect">View Individual Student Calendar</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger id="studentSelect"><SelectValue placeholder="Select a student..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">View Class Summary</SelectItem>
                        {studentsInClass.map(student => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          )}

          {!isLoadingPage && !currentSchoolId && (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view attendance.</p>
          )}

          {isLoadingReport && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading attendance report...</div>}

          {!isLoadingReport && searchAttempted && !selectedStudentId && (
            <>
              <h3 className="text-lg font-medium my-2">Class Attendance Summary</h3>
              {attendanceSummary.length > 0 ? (
                <>
                <Button onClick={handleDownloadPdf} disabled={isLoadingReport || attendanceSummary.length === 0} variant="outline" size="sm" className="mb-2">
                    <Download className="mr-2 h-4 w-4" /> Download Class Summary PDF
                </Button>
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
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance records found for the selected period.</p>
              )}
            </>
          )}

           {!isLoadingReport && searchAttempted && selectedStudentId && (
            <div className="border-t mt-6 pt-6">
                <h3 className="text-lg font-semibold mb-4">Attendance Calendar for: {selectedStudentDetails?.name}</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <Calendar
                            mode="single"
                            month={new Date(selectedYear, selectedMonth === 'all' ? new Date().getMonth() : Number(selectedMonth) - 1)}
                            modifiers={calendarModifiers}
                            modifiersClassNames={modifiersClassNames}
                            className="rounded-md border mx-auto"
                        />
                         <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400"></div> Present</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400"></div> Absent</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Late</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Excused</div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-medium mb-2">Detailed Log for {months.find(m => m.value === selectedMonth)?.label}</h4>
                        {selectedStudentRecords.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedStudentRecords.map(rec => (
                                        <TableRow key={rec.date}>
                                            <TableCell>{format(parseISO(rec.date), 'PP')}</TableCell>
                                            <TableCell><Badge variant={rec.status === 'Present' ? 'default' : rec.status === 'Absent' ? 'destructive' : 'secondary'}>{rec.status}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        ) : <p className="text-sm text-muted-foreground text-center py-4">No records for this student in the selected period.</p>}
                    </div>
                </div>
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
    
