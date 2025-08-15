
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Library, Users, Building, Globe, Calendar as CalendarIcon, Download, FileDown, BarChart3 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getLmsGlobalReportAction, type LmsGlobalReportData } from './actions';
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
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

type ChartDataType = 'assignments' | 'enrollments';

export default function SuperAdminLmsReportsPage() {
    const { toast } = useToast();
    const [reportData, setReportData] = useState<LmsGlobalReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [filterPreset, setFilterPreset] = useState('this_year');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfYear(new Date()),
        to: new Date(),
    });
    const [chartType, setChartType] = useState<ChartDataType>('enrollments');

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        const result = await getLmsGlobalReportAction({
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
        const headers = ["Course Title", "Scope", "Assigned Schools", "Total Enrollments"];
        const csvContent = [
            headers.join(','),
            ...reportData.map(d => `"${d.title.replace(/"/g, '""')}",${d.schoolName || 'Global'},${d.assignedSchoolCount},${d.totalEnrollments}`)
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `lms_global_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const chartData = useMemo(() => {
        const dataKey = chartType === 'enrollments' ? 'totalEnrollments' : 'assignedSchoolCount';
        return reportData
            .filter(d => d[dataKey] > 0)
            .sort((a, b) => b[dataKey] - a[dataKey])
            .slice(0, 10)
            .map(d => ({ name: d.title, count: d[dataKey] }));
    }, [reportData, chartType]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Global LMS Reports"
                description="View aggregate statistics for all courses across the platform."
            />

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                            <div>
                                <CardTitle>Global Course Report</CardTitle>
                                <CardDescription>An overview of school assignments and total user enrollments for each course.</CardDescription>
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
                                    <SelectItem value="this_year">This Year</SelectItem>
                                    <SelectItem value="this_month">This Month</SelectItem>
                                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                    <SelectItem value="all">All Time</SelectItem>
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
                            <p className="text-center text-muted-foreground py-10">No courses found for the selected period.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead><Library className="inline-block h-4 w-4 mr-1" /> Course Title</TableHead>
                                        <TableHead><Globe className="inline-block h-4 w-4 mr-1" /> Scope</TableHead>
                                        <TableHead className="text-center"><Building className="inline-block h-4 w-4 mr-1" /> Assigned Schools</TableHead>
                                        <TableHead className="text-center"><Users className="inline-block h-4 w-4 mr-1" /> Total Enrollments</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map(course => (
                                        <TableRow key={course.id}>
                                            <TableCell className="font-medium">{course.title}</TableCell>
                                            <TableCell>{course.schoolName || 'Global'}</TableCell>
                                            <TableCell className="text-center">{course.assignedSchoolCount}</TableCell>
                                            <TableCell className="text-center">{course.totalEnrollments}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5"/>Top 10 Courses</CardTitle>
                        <Select value={chartType} onValueChange={(val) => setChartType(val as ChartDataType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="enrollments">By Total Enrollments</SelectItem>
                                <SelectItem value="assignments">By School Assignments</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div> :
                         chartData.length === 0 ? <p className="text-muted-foreground text-center py-10">No data to display in chart.</p> :
                         <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                            <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} className="text-xs" width={80} interval={0} />
                                <XAxis dataKey="count" type="number" hide />
                                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent indicator="line" />}/>
                                <Bar dataKey="count" layout="vertical" fill="var(--color-count)" radius={4} />
                            </BarChart>
                         </ChartContainer>
                        }
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
