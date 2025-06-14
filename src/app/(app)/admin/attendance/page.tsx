
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord, ClassAttendance } from '@/types';
import { useState, useEffect } from 'react';
import { ListChecks, Users, CalendarDays, Search } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_ATTENDANCE_KEY_PREFIX = 'mockAttendanceData_'; 

export default function AdminAttendancePage() {
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [displayedAttendance, setDisplayedAttendance] = useState<Array<AttendanceRecord & { studentName: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setAllClasses(storedActiveClasses ? JSON.parse(storedActiveClasses) : []);
      
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setAllStudents(storedStudents ? JSON.parse(storedStudents) : []);
    }
  }, []);

  const handleSearchAttendance = () => {
    if (!selectedClassSectionId || !selectedDate) {
      alert("Please select both a class and a date.");
      return;
    }
    setIsLoading(true);
    setSearchAttempted(true);
    const attendanceKey = `${MOCK_ATTENDANCE_KEY_PREFIX}${selectedClassSectionId}_${selectedDate}`;
    const storedAttendance = localStorage.getItem(attendanceKey);
    
    let recordsToShow: Array<AttendanceRecord & { studentName: string }> = [];

    if (storedAttendance) {
      const classAttendanceData: ClassAttendance = JSON.parse(storedAttendance);
      recordsToShow = classAttendanceData.records.map(rec => {
        const student = allStudents.find(s => s.id === rec.studentId);
        return {
          ...rec,
          studentName: student ? student.name : 'Unknown Student'
        };
      });
    } else {
      // If no specific record, show all students from that class as 'Not Recorded' or similar
      const studentsInClass = allStudents.filter(s => s.classId === selectedClassSectionId);
      recordsToShow = studentsInClass.map(student => ({
          studentId: student.id,
          studentName: student.name,
          date: selectedDate,
          status: 'Not Recorded' as any, // Using 'any' to allow custom status for display
      }));
    }
    setDisplayedAttendance(recordsToShow);
    setIsLoading(false);
  };
  
  const selectedClassDetails = allClasses.find(c => c.id === selectedClassSectionId);

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
              <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
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
              />
            </div>
            <Button onClick={handleSearchAttendance} disabled={isLoading || !selectedClassSectionId || !selectedDate}>
                <Search className="mr-2 h-4 w-4" /> Search Attendance
            </Button>
          </div>

          {isLoading && <p className="text-muted-foreground text-center py-4">Loading attendance...</p>}
          
          {!isLoading && searchAttempted && displayedAttendance.length === 0 && selectedClassDetails && (
            <p className="text-muted-foreground text-center py-4">No attendance records found for {selectedClassDetails.name} - {selectedClassDetails.division} on {format(parseISO(selectedDate), 'PP')}. It might not have been taken yet.</p>
          )}
          {!isLoading && searchAttempted && displayedAttendance.length === 0 && !selectedClassDetails && (
            <p className="text-muted-foreground text-center py-4">Please select a valid class.</p>
          )}


          {!isLoading && displayedAttendance.length > 0 && (
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
                    <TableRow key={record.studentId}>
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
