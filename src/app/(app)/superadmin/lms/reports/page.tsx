"use client";

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Library, Users, Building, Globe } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getLmsGlobalReportAction, type LmsGlobalReportData } from './actions';

export default function SuperAdminLmsReportsPage() {
    const { toast } = useToast();
    const [reportData, setReportData] = useState<LmsGlobalReportData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReportData = useCallback(async () => {
        setIsLoading(true);
        const result = await getLmsGlobalReportAction();
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
                title="Global LMS Reports"
                description="View aggregate statistics for all courses across the platform."
            />
            <Card>
                <CardHeader>
                    <CardTitle>Global Course Report</CardTitle>
                    <CardDescription>An overview of school assignments and total user enrollments for each course.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : reportData.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No courses found to generate a report.</p>
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
        </div>
    );
}
