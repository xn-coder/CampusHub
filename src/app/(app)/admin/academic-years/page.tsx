
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarRange, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import AcademicYearActions from './academic-year-actions';
import type { AcademicYear } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getAdminSchoolIdAction, getAcademicYearsForSchoolAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function AcademicYearsPage() {
  const { toast } = useToast();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPageData = useCallback(async (adminUserId: string) => {
    const fetchedSchoolId = await getAdminSchoolIdAction(adminUserId);
    setSchoolId(fetchedSchoolId);

    if (fetchedSchoolId) {
      const result = await getAcademicYearsForSchoolAction(fetchedSchoolId);
      if (result.ok && result.years) {
        setAcademicYears(result.years);
      } else {
        toast({ title: "Error", description: result.message || "Failed to load academic years.", variant: "destructive" });
        setAcademicYears([]);
      }
    } else {
      toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      setAcademicYears([]);
    }
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    setIsLoading(true);
    const adminUserId = localStorage.getItem('currentUserId');
    if (!adminUserId) {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    fetchPageData(adminUserId);
  }, [fetchPageData, toast]);

  const formatDateString = (dateString: string | Date) => {
    if (!dateString) return 'N/A';
    const dateObj = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : 'Invalid Date';
  };

  const handleActionCompletion = () => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      fetchPageData(adminUserId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Academic Year Management" />
        <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />Loading academic years...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academic Year Management"
        description="Define and manage academic years for the school."
        actions={<AcademicYearActions schoolId={schoolId} onActionComplete={handleActionCompletion} />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarRange className="mr-2 h-5 w-5" />Academic Years</CardTitle>
          <CardDescription>List of all defined academic years, newest start date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!schoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school or school ID not found. Cannot manage academic years.</p>
          ) : academicYears.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No academic years defined yet for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell>{formatDateString(year.start_date)}</TableCell>
                    <TableCell>{formatDateString(year.end_date)}</TableCell>
                    <TableCell className="text-right">
                       <AcademicYearActions
                        schoolId={schoolId}
                        existingYear={{
                          id: year.id,
                          name: year.name,
                          startDate: new Date(year.start_date),
                          endDate: new Date(year.end_date),
                          schoolId: year.school_id
                        }}
                        onActionComplete={handleActionCompletion}
                      />
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
