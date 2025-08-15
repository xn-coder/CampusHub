
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord, Holiday } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Users, Search, Loader2, Download, Calendar as CalendarIcon, UserCheck, UserX, Clock, Ban } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getAdminAttendancePageDataAction, fetchAttendanceForReportAction } from './actions';
import type jsPDF from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { Calendar } from '@/components/ui/calendar';
import { isValid, parseISO, format, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
import type { DateRange } from 'react-day-picker';

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

const chartConfig = {
  present: { label: "Present", color: "hsl(var(--chart-1))" },
  absent: { label: "Absent", color: "hsl(var(--chart-2))" },
  late: { label: "Late", color: "hsl(var(--chart-3))" },
  excused: { label: "Excused", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

const years = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

export default function AdminAttendancePage() {
  const { toast } = useToast();
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [allFetchedRecords, setAllFetchedRecords] = useState<Pick<AttendanceRecord, 'student_id' | 'status' | 'date'>[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterType, setFilterType] = useState<'all_year' | 'month' | 'date_range'>('all_year');
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
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
      setHolidays(result.holidays || []);
    } else {
      toast({ title: "Error loading initial data", description: result.message, variant: "destructive" });
    }
    setIsLoadingPage(false);
  }
  
  const handleSearchAttendance = async () => {
    if (!selectedClassId || !currentSchoolId) {
      toast({title: "Error", description: "Please select a class.", variant: "destructive"});
      return;
    }
    setIsLoadingReport(true);
    setSearchAttempted(true);

    let startDate, endDate;
    const yearDate = new Date(selectedYear, 0, 1);

    if (filterType === 'all_year') {
        startDate = startOfYear(yearDate);
        endDate = endOfYear(yearDate);
    } else if (filterType === 'month') {
        const monthIndex = parseInt(selectedMonth) - 1;
        startDate = startOfMonth(new Date(selectedYear, monthIndex));
        endDate = endOfMonth(new Date(selectedYear, monthIndex));
    } else { // 'date_range'
        if (!dateRange?.from || !dateRange?.to) {
            toast({title: "Error", description: "Please select a valid date range.", variant: "destructive"});
            setIsLoadingReport(false);
            return;
        }
        startDate = dateRange.from;
        endDate = dateRange.to;
    }
    
    const result = await fetchAttendanceForReportAction(currentSchoolId, selectedClassId, startDate, endDate);
    if (result.ok && result.records) {
        setAllFetchedRecords(result.records);
    } else {
        toast({title: "Error Fetching Report Data", description: result.message, variant: "destructive"});
        setAllFetchedRecords([]);
    }
    setIsLoadingReport(false);
  };
  
  const studentsInClass = useMemo(() => {
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [allStudents, selectedClassId]);
  
  const overallSummaryForChart = useMemo(() => {
    const summary = { present: 0, absent: 0, late: 0, excused: 0 };
    attendanceSummary.forEach(record => {
        summary.present += record.present;
        summary.absent += record.absent;
        summary.late += record.late;
        summary.excused += record.excused;
    });
    return Object.entries(summary).map(([status, count]) => ({ status, count }));
  }, [attendanceSummary]);

  useEffect(() => {
    if (allFetchedRecords.length > 0 || (searchAttempted && !isLoadingReport)) {
        const allDatesForPeriod = new Set(allFetchedRecords.map(r => r.date.split('T')[0]));
        const totalRecordedDays = allDatesForPeriod.size;
        
        const summary = studentsInClass.map(student => {
            const studentRecords = allFetchedRecords.filter(r => r.student_id === student.id);
            const present = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
            const absent = totalRecordedDays - present; 
            const percentage = totalRecordedDays > 0 ? (present / totalRecordedDays) * 100 : 0;
            return {
                studentId: student.id,
                studentName: student.name,
                present,
                absent,
                late: studentRecords.filter(r => r.status === 'Late').length,
                excused: studentRecords.filter(r => r.status === 'Excused').length,
                total: totalRecordedDays,
                percentage
            };
        });
        setAttendanceSummary(summary);
    } else {
        setAttendanceSummary([]);
    }
  }, [allFetchedRecords, studentsInClass, searchAttempted, isLoadingReport]);

  const handleDownloadPdf = async () => {
    if (attendanceSummary.length === 0) {
      toast({ title: "No data to download", variant: "destructive"});
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF() as JsPDFWithAutoTable;
    const selectedClass = allClasses.find(c => c.id === selectedClassId);
    doc.text(`Attendance Report for ${selectedClass?.name} - ${selectedClass?.division}`, 14, 22);
    autoTable(doc, {
        startY: 30,
        head: [['Student Name', 'Present', 'Absent', 'Late', 'Excused', 'Attendance %']],
        body: attendanceSummary.map(s => [s.studentName, s.present, s.absent, s.late, s.excused, `${s.percentage.toFixed(2)}%`]),
    });
    doc.save(`Attendance_${selectedClass?.name}.pdf`);
  };
  
  const handleDownloadCsv = () => {
    if (attendanceSummary.length === 0) {
      toast({ title: "No data to download", variant: "destructive" });
      return;
    }
    const headers = ['Student Name', 'Present', 'Absent', 'Late', 'Excused', 'Attendance %'];
    const rows = attendanceSummary.map(s => [s.studentName, s.present, s.absent, s.late, s.excused, `${s.percentage.toFixed(2)}%`]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    const selectedClass = allClasses.find(c => c.id === selectedClassId);
    link.setAttribute('download', `Attendance_${selectedClass?.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="View Attendance Reports" 
        description="Generate and download monthly or yearly attendance reports for your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Attendance Report Generator</CardTitle>
          <CardDescription>Select a class and time period to generate a report.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
                <Label htmlFor="filterType">Filter Type</Label>
                <Select value={filterType} onValueChange={(val) => setFilterType(val as any)}>
                    <SelectTrigger id="filterType"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_year">All Year</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="date_range">Date Range</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filterType === 'month' && (
                <div>
                    <Label htmlFor="monthSelect">Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger id="monthSelect"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 12}, (_, i) => <SelectItem key={i+1} value={String(i+1)}>{format(new Date(0, i), 'MMMM')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {filterType === 'date_range' && (
                <div className="lg:col-span-2">
                    <Label>Date Range</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date range</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            <Button onClick={handleSearchAttendance} disabled={isLoadingPage || isLoadingReport || !selectedClassId} className="w-full">
                {isLoadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />} Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchAttempted && !isLoadingReport && (
        <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
                 <CardHeader>
                    <CardTitle>Overall Summary</CardTitle>
                    <CardDescription>Aggregate data for the period.</CardDescription>
                </CardHeader>
                <CardContent>
                    {attendanceSummary.length > 0 ? (
                        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                            <BarChart accessibilityLayer data={overallSummaryForChart} layout="vertical" margin={{ left: 10 }}>
                                <YAxis dataKey="status" type="category" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => chartConfig[value as keyof typeof chartConfig]?.label}/>
                                <XAxis dataKey="count" type="number" hide />
                                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent indicator="line" />} />
                                <Bar dataKey="count" layout="vertical" radius={5}>
                                  {overallSummaryForChart.map((entry) => (<Cell key={`cell-${entry.status}`} fill={chartConfig[entry.status as keyof typeof chartConfig].color} />))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">No data to display.</p>
                    )}
                </CardContent>
            </Card>
             <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Student Attendance Details</CardTitle>
                        <CardDescription>Individual attendance records for the selected period.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadCsv} disabled={attendanceSummary.length === 0} variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>CSV</Button>
                        <Button onClick={handleDownloadPdf} disabled={attendanceSummary.length === 0} variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>PDF</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {attendanceSummary.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><Users className="inline-block mr-1 h-4 w-4" />Student Name</TableHead>
                                <TableHead className="text-center">Present</TableHead>
                                <TableHead className="text-center">Absent</TableHead>
                                <TableHead className="text-center">Late</TableHead>
                                <TableHead className="text-center">Excused</TableHead>
                                <TableHead className="text-center">Attendance %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {attendanceSummary.map(record => (
                            <TableRow key={record.studentId}>
                            <TableCell className="font-medium">{record.studentName}</TableCell>
                            <TableCell className="text-center">{record.present}</TableCell>
                            <TableCell className="text-center">{record.absent}</TableCell>
                            <TableCell className="text-center">{record.late}</TableCell>
                            <TableCell className="text-center">{record.excused}</TableCell>
                            <TableCell className="text-center font-semibold">{record.percentage.toFixed(2)}%</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">No attendance records found for the selected period.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
