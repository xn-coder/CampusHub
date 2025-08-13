"use client";

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Library, Users, Briefcase } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getLmsSchoolReportAction, type LmsSchoolReportData } from './actions';

export default function AdminLmsReportsPage() {
    const { toast } = useToast();
    const [reportData, setReportData] = useState<LmsSchoolReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        const adminUserId = localStorage.getItem('currentUserId');
        if (!adminUserId) {
            toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const result = await getLmsSchoolReportAction(adminUserId);
        if (result.ok) {
            setReportData(result.reportData || []);
        } else {
            toast({ title: "Error loading report", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="LMS Reports"
                description="View engagement and enrollment statistics for courses in your school."
            />
            <Card>
                <CardHeader>
                    <CardTitle>Course Enrollment Report</CardTitle>
                    <CardDescription>An overview of student and teacher enrollments for each course assigned to your school.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : reportData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No course data available to generate a report.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Library className="inline-block h-4 w-4 mr-1" /> Course Title</TableHead>
                                    <TableHead className="text-center"><Users className="inline-block h-4 w-4 mr-1" /> Enrolled Students</TableHead>
                                    <TableHead className="text-center"><Briefcase className="inline-block h-4 w-4 mr-1" /> Enrolled Teachers</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.map(course => (
                                    <TableRow key={course.id}>
                                        <TableCell className="font-medium">{course.title}</TableCell>
                                        <TableCell className="text-center">{course.studentEnrollmentCount}</TableCell>
                                        <TableCell className="text-center">{course.teacherEnrollmentCount}</TableCell>
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
