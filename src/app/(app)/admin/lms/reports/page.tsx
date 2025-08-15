
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Library, Users, Briefcase, Calendar as CalendarIcon, FileDown, BarChart3 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getLmsSchoolReportAction, type LmsSchoolReportData } from './actions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const chartConfig = {
  enrollments: { label: "Enrollments", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export default function AdminLmsReportsPage() {
    const { toast } = useToast();
    const [reportData, setReportData] = useState<LmsSchoolReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [filterPreset, setFilterPreset] = useState('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        const adminUserId = localStorage.getItem('currentUserId');
        if (!adminUserId) {
            toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const result = await getLmsSchoolReportAction({
            adminUserId,
            startDate: dateRange?.from?.toISOString(),
            endDate: dateRange?.to?.toISOString(),
        });
        if (result.ok) {
            setReportData(result.reportData || []);
        } else {
            toast({ title: "Error loading report", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    }, [toast, dateRange]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const handleFilterPresetChange = (value: string) => {
        setFilterPreset(value);
        const now = new Date();
        if (value === 'this_year') setDateRange({ from: startOfYear(now), to: now });
        else if (value === 'this_month') setDateRange({ from: startOfMonth(now), to: now });
        else if (value === 'last_7_days') setDateRange({ from: subDays(now, 6), to: now });
        else if (value === 'all') setDateRange(undefined);
    };

    const handleDownloadCsv = () => {
        if (reportData.length === 0) {
            toast({ title: "No data to download", variant: "destructive" });
            return;
        }
        const headers = ["Course Title", "Enrolled Students", "Enrolled Teachers", "Total Enrollments"];
        const csvContent = [
            headers.join(','),
            ...reportData.map(d => `"${d.title.replace(/"/g, '""')}",${d.studentEnrollmentCount},${d.teacherEnrollmentCount},${d.studentEnrollmentCount + d.teacherEnrollmentCount}`)
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `lms_school_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const chartData = useMemo(() => {
        return reportData
            .map(d => ({
                name: d.title,
                enrollments: d.studentEnrollmentCount + d.teacherEnrollmentCount
            }))
            .filter(d => d.enrollments > 0)
            .sort((a, b) => b.enrollments - a.enrollments)
            .slice(0, 10);
    }, [reportData]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="LMS Reports"
                description="View engagement and enrollment statistics for courses in your school."
            />
            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                            <div>
                                <CardTitle>Course Enrollment Report</CardTitle>
                                <CardDescription>An overview of student and teacher enrollments for each course assigned to your school.</CardDescription>
                            </div>
                            <Button onClick={handleDownloadCsv} disabled={isLoading || reportData.length === 0} variant="outline">
                                <FileDown className="mr-2 h-4 w-4" /> Download Report
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="flex flex-wrap gap-2 mb-4">
                            <Select value={filterPreset} onValueChange={handleFilterPresetChange}>
                                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Time</SelectItem>
                                    <SelectItem value="this_year">This Year</SelectItem>
                                    <SelectItem value="this_month">This Month</SelectItem>
                                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>
                            {filterPreset === 'custom' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={"outline"} className="w-full sm:w-auto justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/>
                                    </PopoverContent>
                                </Popover>
                            )}
                             <Button onClick={fetchReportData} disabled={isLoading} className="w-full sm:w-auto">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Apply Filter
                            </Button>
                        </div>
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : reportData.length === 0 ? (
                            <p className="text-center text-muted-foreground py-10">No course data available to generate a report for the selected period.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead><Library className="inline-block h-4 w-4 mr-1" /> Course Title</TableHead>
                                        <TableHead className="text-center"><Users className="inline-block h-4 w-4 mr-1" /> Enrolled Students</TableHead>
                                        <TableHead className="text-center"><Briefcase className="inline-block h-4 w-4 mr-1" /> Enrolled Teachers</TableHead>
                                        <TableHead className="text-center">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map(course => (
                                        <TableRow key={course.id}>
                                            <TableCell className="font-medium">{course.title}</TableCell>
                                            <TableCell className="text-center">{course.studentEnrollmentCount}</TableCell>
                                            <TableCell className="text-center">{course.teacherEnrollmentCount}</TableCell>
                                            <TableCell className="text-center font-bold">{course.studentEnrollmentCount + course.teacherEnrollmentCount}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5"/>Top 10 Courses by Enrollment</CardTitle>
                        <CardDescription>For the selected date range.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div> :
                         chartData.length === 0 ? <p className="text-muted-foreground text-center py-10">No enrollment data for selected period.</p> :
                         <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                            <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} className="text-xs" width={80} interval={0} />
                                <XAxis dataKey="enrollments" type="number" hide />
                                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent indicator="line" />}/>
                                <Bar dataKey="enrollments" layout="vertical" fill="var(--color-enrollments)" radius={4} />
                            </BarChart>
                         </ChartContainer>
                        }
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
