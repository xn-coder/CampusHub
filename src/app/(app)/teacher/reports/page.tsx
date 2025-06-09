
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { Student, ClassData } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowDownUp, BarChartHorizontalBig } from 'lucide-react';
import { format } from 'date-fns';

const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';

// Helper to generate mock activity data (can be shared or duplicated)
const generateMockActivity = (student: Student): Student => {
  const today = new Date();
  // Ensure mockLoginDate is a Date object, or create one if missing
  const loginDateSeed = student.mockLoginDate instanceof Date ? student.mockLoginDate : new Date(today.setDate(today.getDate() - Math.floor(Math.random() * 30)));
  
  return {
    ...student,
    mockLoginDate: loginDateSeed, // Ensure this is a Date object
    lastLogin: student.lastLogin || format(loginDateSeed, 'PPpp'),
    assignmentsSubmitted: student.assignmentsSubmitted ?? Math.floor(Math.random() * 20),
    attendancePercentage: student.attendancePercentage ?? Math.floor(Math.random() * 51) + 50, // 50-100%
  };
};

export default function TeacherReportsPage() {
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all'); // classId or 'all'
  const [sortBy, setSortBy] = useState<keyof Student | ''>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const allClasses: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
      const assignedClasses = teacherId ? allClasses.filter(c => c.teacherId === teacherId) : [];
      setTeacherClasses(assignedClasses);
      
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      const allStudentsData: Student[] = storedStudents ? JSON.parse(storedStudents) : [];

      if (teacherId) {
        const assignedClassIds = assignedClasses.map(c => c.id);
        const studentsForTeacher = allStudentsData
          .filter(s => s.classId && assignedClassIds.includes(s.classId))
          .map(generateMockActivity);
        setTeacherStudents(studentsForTeacher);
      }
    }
  }, []);

  const handleSort = (column: keyof Student | '') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getClassDisplayName = (classId: string): string => {
    const classInfo = teacherClasses.find(c => c.id === classId);
    return classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';
  };

  const filteredAndSortedStudents = useMemo(() => {
    let students = [...teacherStudents];

    if (searchTerm) {
      students = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedClassFilter !== 'all') {
      students = students.filter(s => s.classId === selectedClassFilter);
    }
    
    if (sortBy) {
      students.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'mockLoginDate') {
           valA = a.mockLoginDate ? a.mockLoginDate.getTime() : 0;
           valB = b.mockLoginDate ? b.mockLoginDate.getTime() : 0;
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
        } else if (typeof valA === 'undefined') {
           valA = sortBy === 'assignmentsSubmitted' || sortBy === 'attendancePercentage' ? -1 : '';
        }
        
        if (typeof valB === 'string') {
          valB = valB.toLowerCase();
        } else if (typeof valB === 'undefined') {
           valB = sortBy === 'assignmentsSubmitted' || sortBy === 'attendancePercentage' ? -1 : '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return students;
  }, [teacherStudents, searchTerm, selectedClassFilter, sortBy, sortOrder]);

  const SortableHeader = ({ column, label }: { column: keyof Student; label: string }) => (
    <TableHead onClick={() => handleSort(column)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-1">
        {label}
        {sortBy === column && <ArrowDownUp className="h-3 w-3" />}
      </div>
    </TableHead>
  );
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Activity Reports (Teacher)" 
        description="View activity for students in your assigned classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5" />My Students' Activity</CardTitle>
          <CardDescription>Monitor engagement for students you teach.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search your students by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={teacherClasses.length === 0}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Classes</SelectItem>
                {teacherClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {teacherClasses.length === 0 && (
             <p className="text-muted-foreground text-center py-4">You are not assigned to any classes. Reports will be available once you are assigned.</p>
          )}

          {teacherClasses.length > 0 && filteredAndSortedStudents.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No student records found matching your criteria in your classes.</p>
          )}
          
          {teacherClasses.length > 0 && filteredAndSortedStudents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name" label="Student Name" />
                  <SortableHeader column="email" label="Email" />
                  <TableHead>Class</TableHead>
                  <SortableHeader column="mockLoginDate" label="Last Login" />
                  <SortableHeader column="assignmentsSubmitted" label="Assignments Submitted" />
                  <SortableHeader column="attendancePercentage" label="Attendance (%)" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{getClassDisplayName(student.classId)}</TableCell>
                    <TableCell>{student.lastLogin || 'N/A'}</TableCell>
                    <TableCell>{student.assignmentsSubmitted ?? 'N/A'}</TableCell>
                    <TableCell>{student.attendancePercentage !== undefined ? `${student.attendancePercentage}%` : 'N/A'}</TableCell>
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
