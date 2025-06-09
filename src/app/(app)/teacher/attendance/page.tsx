
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, AttendanceRecord, ClassAttendance } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, XSquare, Edit, Save, ListChecks, Users } from 'lucide-react';
import { format } from 'date-fns';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_ATTENDANCE_KEY_PREFIX = 'mockAttendanceData_'; // Prefix + classSectionId + date

export default function TeacherAttendancePage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord['status']>>({}); // studentId: status
  const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('currentUserId');
      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      
      if (userId && storedActiveClasses) {
        const allClasses: ClassData[] = JSON.parse(storedActiveClasses);
        const teacherClasses = allClasses.filter(cls => cls.teacherId === userId);
        setAssignedClasses(teacherClasses);
        if (teacherClasses.length > 0) {
          // setSelectedClassSectionId(teacherClasses[0].id); // Auto-select first class initially
        }
      }
    }
  }, []);

  useEffect(() => {
    if (selectedClassSectionId && typeof window !== 'undefined') {
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      if (storedStudents) {
        const allStudents: Student[] = JSON.parse(storedStudents);
        const classStudents = allStudents.filter(s => s.classId === selectedClassSectionId);
        setStudentsInSelectedClass(classStudents);
        loadAttendanceForClassAndDate(selectedClassSectionId, currentDate, classStudents);
      } else {
        setStudentsInSelectedClass([]);
        setAttendanceRecords({});
      }
    } else {
      setStudentsInSelectedClass([]);
      setAttendanceRecords({});
    }
  }, [selectedClassSectionId, currentDate]);

  const loadAttendanceForClassAndDate = (classId: string, date: string, students: Student[]) => {
    setIsLoading(true);
    const attendanceKey = `${MOCK_ATTENDANCE_KEY_PREFIX}${classId}_${date}`;
    const storedAttendance = localStorage.getItem(attendanceKey);
    const initialRecords: Record<string, AttendanceRecord['status']> = {};
    
    if (storedAttendance) {
      const savedRecords: ClassAttendance = JSON.parse(storedAttendance);
      savedRecords.records.forEach(rec => {
        initialRecords[rec.studentId] = rec.status;
      });
    } else {
      // Default to 'Present' if no record exists for the day
      students.forEach(student => {
        initialRecords[student.id] = 'Present';
      });
    }
    setAttendanceRecords(initialRecords);
    setIsLoading(false);
  };

  const handleAttendanceChange = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = () => {
    if (!selectedClassSectionId) {
      toast({ title: "Error", description: "Please select a class.", variant: "destructive" });
      return;
    }
    if (studentsInSelectedClass.length === 0) {
        toast({ title: "No Students", description: "No students in the selected class to mark attendance for.", variant: "destructive"});
        return;
    }

    const recordsToSave: AttendanceRecord[] = studentsInSelectedClass.map(student => ({
      studentId: student.id,
      date: currentDate,
      status: attendanceRecords[student.id] || 'Present', // Default to present if somehow missing
    }));

    const classAttendanceData: ClassAttendance = {
      classSectionId: selectedClassSectionId,
      records: recordsToSave,
    };

    const attendanceKey = `${MOCK_ATTENDANCE_KEY_PREFIX}${selectedClassSectionId}_${currentDate}`;
    localStorage.setItem(attendanceKey, JSON.stringify(classAttendanceData));
    toast({ title: "Attendance Saved", description: `Attendance for ${currentDate} has been saved.` });
  };
  
  const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassSectionId);

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
              <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
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
              />
            </div>
          </div>

          {isLoading && <p className="text-muted-foreground text-center py-4">Loading attendance...</p>}
          
          {!isLoading && selectedClassSectionId && studentsInSelectedClass.length === 0 && (
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
                          onValueChange={(value) => handleAttendanceChange(student.id, value as AttendanceRecord['status'])}
                          className="flex space-x-2 sm:space-x-4 justify-center"
                        >
                          {(['Present', 'Absent', 'Late', 'Excused'] as AttendanceRecord['status'][]).map(status => (
                            <div key={status} className="flex items-center space-x-1">
                              <RadioGroupItem value={status} id={`${student.id}-${status}`} />
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
        {studentsInSelectedClass.length > 0 && (
          <CardFooter>
            <Button onClick={handleSaveAttendance} disabled={isLoading}><Save className="mr-2 h-4 w-4" /> Save Attendance</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
