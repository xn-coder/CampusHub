
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AttendanceRecord, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getStudentAttendanceHistoryAction } from './actions';
import { format, parseISO, isValid } from 'date-fns';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const chartConfig = {
  Present: { label: "Present", color: "hsl(var(--chart-1))" },
  Absent: { label: "Absent", color: "hsl(var(--chart-2))" },
  Late: { label: "Late", color: "hsl(var(--chart-3))" },
  Excused: { label: "Excused", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;


export default function StudentAttendanceHistoryPage() {
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      const studentUserId = localStorage.getItem('currentUserId');
      if (!studentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const { data: studentProfile, error } = await supabase
        .from('students')
        .select('id, school_id')
        .eq('user_id', studentUserId)
        .single();
      
      if (error || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
        toast({ title: "Error", description: "Could not fetch student profile or school info.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const result = await getStudentAttendanceHistoryAction(studentProfile.id, studentProfile.school_id);
      if (result.ok) {
        setAttendance(result.records || []);
      } else {
        toast({ title: "Error", description: result.message || "Failed to load attendance history.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    fetchHistory();
  }, [toast]);

  const summary = useMemo(() => {
    const data = {
      Present: 0,
      Absent: 0,
      Late: 0,
      Excused: 0,
    };
    attendance.forEach(record => {
      if (data[record.status as keyof typeof data] !== undefined) {
        data[record.status as keyof typeof data]++;
      }
    });
    return Object.entries(data).map(([status, count]) => ({ status, count }));
  }, [attendance]);

  const formatDateSafe = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Attendance History" 
        description="View your attendance records and summary." 
      />

      <Card>
          <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
              <CardDescription>A visual overview of your attendance record.</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoading ? (
                  <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : attendance.length > 0 ? (
                  <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                      <BarChart accessibilityLayer data={summary} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid horizontal={false} />
                          <YAxis dataKey="status" type="category" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => chartConfig[value as keyof typeof chartConfig]?.label} />
                          <XAxis dataKey="count" type="number" hide />
                          <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent indicator="line" />} />
                          <Bar dataKey="count" layout="vertical" radius={5}>
                            {summary.map((entry) => (
                                <Cell key={`cell-${entry.status}`} fill={chartConfig[entry.status as keyof typeof chartConfig].color} />
                            ))}
                          </Bar>
                      </BarChart>
                  </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-center py-4">No attendance data to display.</p>
              )}
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardCheck className="mr-2 h-5 w-5" />Attendance Log</CardTitle>
          <CardDescription>A detailed log of your attendance, sorted by most recent.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading records...</div>
          ) : attendance.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No attendance records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{formatDateSafe(record.date)}</TableCell>
                    <TableCell>
                      <Badge variant={record.status === 'Present' ? 'default' : record.status === 'Absent' ? 'destructive' : 'secondary'}>
                        {record.status}
                      </Badge>
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
