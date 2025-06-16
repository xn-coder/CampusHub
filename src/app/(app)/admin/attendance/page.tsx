
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord } from '@/types';
import { useState, useEffect } from 'react';
import { ListChecks, Users, CalendarDays, Search, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { getAdminAttendancePageDataAction, fetchAttendanceRecordsAction } from './actions';

export default function AdminAttendancePage() {
  const { toast } = useToast();
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]); // All students for the school
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [displayedAttendance, setDisplayedAttendance] = useState<Array<AttendanceRecord & { studentName: string }>>([]);
  
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
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
    if (!selectedClassId || !selectedDate || !currentSchoolId) {
      toast({title: "Error", description: "Please select a class and date, and ensure school context is available.", variant: "destructive"});
      return;
    }
    setIsLoadingRecords(true);
    setSearchAttempted(true);
    
    const result = await fetchAttendanceRecordsAction(currentSchoolId, selectedClassId, selectedDate);
    let recordsToShow: Array<AttendanceRecord & { studentName: string }> = [];

    if (result.ok && result.records) {
      recordsToShow = result.records.map(rec => {
        const student = allStudents.find(s => s.id === rec.student_id);
        return {
          ...rec,
          studentName: student ? student.name : 'Unknown Student'
        };
      });
    } else if (!result.ok) {
        toast({title: "Error Fetching Records", description: result.message, variant: "destructive"});
    }
    
    // If no specific records found for the day, show all students from that class as 'Not Recorded'
    if (recordsToShow.length === 0) {
        const studentsInClass = allStudents.filter(s => s.class_id === selectedClassId);
        recordsToShow = studentsInClass.map(student => ({
            student_id: student.id,
            studentName: student.name,
            date: selectedDate,
            status: 'Not Recorded' as any, // Using 'any' to allow custom status for display
            class_id: selectedClassId,
            school_id: currentSchoolId,
            taken_by_teacher_id: '', // Placeholder
        }));
    }

    setDisplayedAttendance(recordsToShow);
    setIsLoadingRecords(false);
  };
  
  const selectedClassDetails = allClasses.find(c => c.id === selectedClassId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="View Attendance Records" 
        description="Review student attendance data submitted by teachers." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Consolidated Attendance</CardTitle>
          <CardDescription>Select a class and date to view attendance records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingPage || !currentSchoolId}>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.length > 0 ? allClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                  )) : <SelectItem value="-" disabled>No classes found</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateSelect">Select Date</Label>
              <input 
                type="date" 
                id="dateSelect" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoadingPage || !currentSchoolId}
              />
            </div>
            <Button onClick={handleSearchAttendance} disabled={isLoadingPage || isLoadingRecords || !selectedClassId || !selectedDate || !currentSchoolId}>
                {isLoadingRecords ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />} Search
            </Button>
          </div>

          {isLoadingPage && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading page data...</div>}
          {isLoadingRecords && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading attendance records...</div>}
          
          {!isLoadingPage && !currentSchoolId && (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view attendance.</p>
          )}

          {!isLoadingPage && !isLoadingRecords && searchAttempted && displayedAttendance.length === 0 && selectedClassDetails && (
            <p className="text-muted-foreground text-center py-4">No attendance records found for {selectedClassDetails.name} - {selectedClassDetails.division} on {format(parseISO(selectedDate), 'PP')}. It might not have been taken yet.</p>
          )}
          {!isLoadingPage && !isLoadingRecords && searchAttempted && displayedAttendance.length === 0 && !selectedClassDetails && selectedClassId && (
            <p className="text-muted-foreground text-center py-4">Please select a valid class.</p>
          )}

          {!isLoadingPage && !isLoadingRecords && displayedAttendance.length > 0 && (
            <div className="overflow-x-auto">
                <h3 className="text-lg font-medium my-2">Attendance for {selectedClassDetails?.name} - {selectedClassDetails?.division} on {format(parseISO(selectedDate), 'PP')}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Users className="inline-block mr-1 h-4 w-4" />Student Name</TableHead>
                    <TableHead className="text-center"><CalendarDays className="inline-block mr-1 h-4 w-4" />Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedAttendance.map(record => (
                    <TableRow key={record.student_id}>
                      <TableCell className="font-medium">{record.studentName}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'Present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          record.status === 'Absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          record.status === 'Late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          record.status === 'Excused' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' // For 'Not Recorded'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Attendance is recorded by class teachers. Select a class and date to view the submitted records.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
    