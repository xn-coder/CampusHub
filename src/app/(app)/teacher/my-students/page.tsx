
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Filter, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTeacherStudentsAndClassesAction } from './actions';

export default function MyStudentsPage() {
  const { toast } = useToast();
  const [allMyStudents, setAllMyStudents] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all'); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
        setError("Access denied. You must be logged in as a teacher.");
        setIsLoading(false);
        return;
    }

    const result = await getTeacherStudentsAndClassesAction(teacherUserId);

    if (result.ok) {
        setTeacherClasses(result.classes || []);
        setAllMyStudents(result.students || []);
    } else {
        setError(result.message || "An unknown error occurred.");
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'all') {
      return allMyStudents;
    }
    return allMyStudents.filter(student => student.class_id === selectedClassFilter);
  }, [allMyStudents, selectedClassFilter]);

  const getClassDisplayName = (classId?: string | null): string => {
    if (!classId) return 'N/A';
    const classInfo = teacherClasses.find(c => c.id === classId);
    return classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';
  };
  
  if (isLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My Student Roster" />
            <Card><CardContent className="pt-6 text-center flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading student roster...</CardContent></Card>
        </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Student Roster" />
        <Card><CardContent className="pt-6 text-center text-destructive">{error}</CardContent></Card>
      </div>
    );
  }

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
          {teacherClasses.length === 0 ? (
             <p className="text-muted-foreground text-center py-4">You are not assigned to any classes. Students will appear here once you are assigned.</p>
          ) : (
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
                              <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
                              <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{getClassDisplayName(student.class_id)}</TableCell>
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
