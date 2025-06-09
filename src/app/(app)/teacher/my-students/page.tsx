
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Users, Filter } from 'lucide-react';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';

export default function MyStudentsPage() {
  const [allMyStudents, setAllMyStudents] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all'); // 'all' or a classId
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') {
      try {
        const currentUserId = localStorage.getItem('currentUserId');
        const currentUserRole = localStorage.getItem('currentUserRole') as UserRole | null;

        if (!currentUserId || currentUserRole !== 'teacher') {
          setError("Access denied. You must be logged in as a teacher.");
          setIsLoading(false);
          return;
        }

        const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
        const allActiveClasses: ClassData[] = storedActiveClasses ? JSON.parse(storedActiveClasses) : [];
        
        const assignedClasses = allActiveClasses.filter(cls => cls.teacherId === currentUserId);
        setTeacherClasses(assignedClasses);

        if (assignedClasses.length === 0) {
          setIsLoading(false);
          return;
        }
        
        const assignedClassIds = assignedClasses.map(c => c.id);

        const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
        const allStudentsData: Student[] = storedStudents ? JSON.parse(storedStudents) : [];
        
        const studentsForTeacher = allStudentsData.filter(s => s.classId && assignedClassIds.includes(s.classId));
        setAllMyStudents(studentsForTeacher);

      } catch (e) {
        console.error("Failed to load student/class data:", e);
        setError("An error occurred while loading student information.");
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'all') {
      return allMyStudents;
    }
    return allMyStudents.filter(student => student.classId === selectedClassFilter);
  }, [allMyStudents, selectedClassFilter]);

  const getClassDisplayName = (classId: string): string => {
    const classInfo = teacherClasses.find(c => c.id === classId);
    return classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Student Roster" 
        description="View and manage students in your assigned classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Student List</CardTitle>
          <CardDescription>A comprehensive list of students you teach. Filter by class.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground text-center py-4">Loading students...</p>}
          {error && <p className="text-destructive text-center py-4">{error}</p>}
          
          {!isLoading && !error && teacherClasses.length === 0 && (
             <p className="text-muted-foreground text-center py-4">You are not assigned to any classes. Students will appear here once you are assigned.</p>
          )}

          {!isLoading && !error && teacherClasses.length > 0 && (
            <>
              <div className="mb-4">
                <Label htmlFor="classFilter" className="flex items-center mb-1"><Filter className="mr-1 h-3 w-3"/>Filter by Class</Label>
                <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                  <SelectTrigger id="classFilter" className="max-w-xs">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All My Students</SelectItem>
                    {teacherClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} - {cls.division}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredStudents.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {selectedClassFilter === 'all' ? 'No students found in your classes.' : 'No students found in the selected class.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avatar</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Class - Section</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <Avatar>
                              <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person student" />
                              <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{getClassDisplayName(student.classId)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
