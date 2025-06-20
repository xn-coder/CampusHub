
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord, AttendanceStatus, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Save, ListChecks, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { saveAttendanceAction } from './actions';

export default function TeacherAttendancePage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceStatus>>({}); // studentId: status
  const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null); // Teacher Profile ID (teachers.id)
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialTeacherData() {
      setIsFetchingInitialData(true);
      const teacherUserId = localStorage.getItem('currentUserId'); // This is User.id
      const role = localStorage.getItem('currentUserRole') as UserRole | null;

      if (!teacherUserId || role !== 'teacher') {
        toast({ title: "Error", description: "Access denied. You must be logged in as a teacher.", variant: "destructive" });
        setIsFetchingInitialData(false);
        return;
      }

      // Get teacher's profile ID and school_id
      const { data: teacherProfile, error: teacherProfileError } = await supabase
        .from('teachers')
        .select('id, school_id') // teachers.id is the profile ID
        .eq('user_id', teacherUserId)
        .single();

      if (teacherProfileError || !teacherProfile) {
        toast({ title: "Error", description: "Could not load teacher profile.", variant: "destructive" });
        setIsFetchingInitialData(false);
        return;
      }
      setCurrentTeacherId(teacherProfile.id);
      setCurrentSchoolId(teacherProfile.school_id);

      // Fetch classes assigned to this teacher
      if (teacherProfile.id && teacherProfile.school_id) {
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('id, name, division')
          .eq('teacher_id', teacherProfile.id)
          .eq('school_id', teacherProfile.school_id);

        if (classesError) {
          toast({ title: "Error", description: "Failed to fetch assigned classes.", variant: "destructive" });
        } else {
          setAssignedClasses(classesData || []);
        }
      }
      setIsFetchingInitialData(false);
    }
    loadInitialTeacherData();
  }, [toast]);

  useEffect(() => {
    async function loadStudentsAndAttendance() {
      if (!selectedClassId || !currentSchoolId || !currentDate) {
        setStudentsInSelectedClass([]);
        setAttendanceRecords({});
        return;
      }
      setIsLoading(true);

      // Fetch students in the selected class
      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('school_id', currentSchoolId);

      if (studentsError) {
        toast({ title: "Error", description: "Failed to fetch students for the class.", variant: "destructive" });
        setStudentsInSelectedClass([]);
        setAttendanceRecords({});
        setIsLoading(false);
        return;
      }
      setStudentsInSelectedClass(classStudents || []);

      // Fetch existing attendance records for these students on the selected date
      const studentIds = (classStudents || []).map(s => s.id);
      if (studentIds.length > 0) {
        const { data: existingDbRecords, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .eq('class_id', selectedClassId)
          .eq('date', currentDate)
          .eq('school_id', currentSchoolId)
          .in('student_id', studentIds);
        
        const initialRecords: Record<string, AttendanceStatus> = {};
        (classStudents || []).forEach(student => {
          const foundRecord = existingDbRecords?.find(r => r.student_id === student.id);
          initialRecords[student.id] = foundRecord ? foundRecord.status as AttendanceStatus : 'Present'; // Default to Present
        });
        setAttendanceRecords(initialRecords);
        
        if (attendanceError) {
          toast({ title: "Warning", description: "Could not fetch existing attendance records, defaulting to 'Present'.", variant: "default" });
        }
      } else {
        setAttendanceRecords({}); // No students, no records
      }
      setIsLoading(false);
    }
    loadStudentsAndAttendance();
  }, [selectedClassId, currentDate, currentSchoolId, toast]);

  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Class, teacher, or school context is missing.", variant: "destructive" });
      return;
    }
    if (studentsInSelectedClass.length === 0) {
      toast({ title: "No Students", description: "No students in the selected class to mark attendance for.", variant: "destructive"});
      return;
    }
    setIsLoading(true);

    const recordsToSubmit: { student_id: string; status: AttendanceStatus }[] = studentsInSelectedClass.map(student => ({
      student_id: student.id,
      status: attendanceRecords[student.id] || 'Present', // Default to present if somehow missing
    }));

    const result = await saveAttendanceAction({
      class_id: selectedClassId,
      date: currentDate,
      records: recordsToSubmit,
      teacher_id: currentTeacherId,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Attendance Saved", description: `${result.message}` });
    } else {
      toast({ title: "Error Saving Attendance", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassId);
  
  if (isFetchingInitialData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Class Attendance" />
        <Card><CardContent className="pt-6 text-center flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading teacher data...</CardContent></Card>
      </div>
    );
  }
  if (!currentTeacherId || !currentSchoolId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Class Attendance" />
        <Card><CardContent className="pt-6 text-center text-destructive">Could not load teacher profile or school association. Cannot manage attendance.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class Attendance" 
        description="Mark and manage student attendance for your assigned classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Mark Attendance</CardTitle>
          <CardDescription>Select your class and date to mark attendance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="classSelect">Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || isFetchingInitialData}>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Choose your class" />
                </SelectTrigger>
                <SelectContent>
                  {assignedClasses.length > 0 ? assignedClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                  )) : <SelectItem value="-" disabled>No classes assigned to you</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateSelect">Select Date</Label>
              <input 
                type="date" 
                id="dateSelect" 
                value={currentDate} 
                onChange={(e) => setCurrentDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || isFetchingInitialData}
              />
            </div>
          </div>

          {isLoading && selectedClassId && <p className="text-muted-foreground text-center py-4">Loading students and attendance...</p>}
          
          {!isLoading && selectedClassId && studentsInSelectedClass.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No students found in {selectedClassDetails?.name} - {selectedClassDetails?.division}.</p>
          )}

          {!isLoading && studentsInSelectedClass.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInSelectedClass.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>
                        <RadioGroup 
                          value={attendanceRecords[student.id] || 'Present'} 
                          onValueChange={(value) => handleAttendanceChange(student.id, value as AttendanceStatus)}
                          className="flex space-x-2 sm:space-x-4 justify-center"
                          disabled={isLoading}
                        >
                          {(['Present', 'Absent', 'Late', 'Excused'] as AttendanceStatus[]).map(status => (
                            <div key={status} className="flex items-center space-x-1">
                              <RadioGroupItem value={status} id={`${student.id}-${status}`} disabled={isLoading} />
                              <Label htmlFor={`${student.id}-${status}`} className="text-xs sm:text-sm">{status}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!isLoading && studentsInSelectedClass.length > 0 && selectedClassId && (
          <CardFooter>
            <Button onClick={handleSaveAttendance} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Attendance
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
