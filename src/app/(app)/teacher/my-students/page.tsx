
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Users, Filter, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export default function MyStudentsPage() {
  const { toast } = useToast();
  const [allMyStudents, setAllMyStudents] = useState<Student[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all'); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      const teacherUserId = localStorage.getItem('currentUserId');
      const currentUserRole = localStorage.getItem('currentUserRole') as UserRole | null;

      if (!teacherUserId || currentUserRole !== 'teacher') {
        setError("Access denied. You must be logged in as a teacher.");
        setIsLoading(false);
        return;
      }

      // Get teacher's profile ID and school_id
      const { data: teacherProfile, error: teacherProfileError } = await supabase
        .from('teachers')
        .select('id, school_id') // teachers.id is the profile ID
        .eq('user_id', teacherUserId)
        .single();

      if (teacherProfileError || !teacherProfile) {
        setError("Could not fetch teacher profile.");
        toast({title: "Error", description: "Could not fetch teacher profile.", variant: "destructive"});
        setIsLoading(false);
        return;
      }

      const teacherProfileId = teacherProfile.id;
      const schoolId = teacherProfile.school_id;

      if (!schoolId) {
        setError("Teacher is not associated with a school.");
        toast({title: "Error", description: "Teacher not associated with a school.", variant: "destructive"});
        setIsLoading(false);
        return;
      }

      // Fetch classes assigned to this teacher
      const { data: assignedClassesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, division')
        .eq('teacher_id', teacherProfileId)
        .eq('school_id', schoolId);

      if (classesError) {
        setError(`Failed to load classes: ${classesError.message}`);
        toast({title: "Error", description: `Failed to load classes: ${classesError.message}`, variant: "destructive"});
        setIsLoading(false);
        return;
      }
      setTeacherClasses(assignedClassesData || []);

      if (!assignedClassesData || assignedClassesData.length === 0) {
        setAllMyStudents([]);
        setIsLoading(false);
        return;
      }
      
      const assignedClassIds = assignedClassesData.map(c => c.id);

      // Fetch students in those classes
      const { data: studentsForTeacherData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, email, class_id, profile_picture_url, user_id, school_id')
        .in('class_id', assignedClassIds)
        .eq('school_id', schoolId);
      
      if (studentsError) {
        setError(`Failed to load students: ${studentsError.message}`);
        toast({title: "Error", description: `Failed to load students: ${studentsError.message}`, variant: "destructive"});
        setAllMyStudents([]);
      } else {
        setAllMyStudents(studentsForTeacherData || []);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);

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
          {error && <p className="text-destructive text-center py-4">{error}</p>}
          
          {!error && teacherClasses.length === 0 && !isLoading && (
             <p className="text-muted-foreground text-center py-4">You are not assigned to any classes. Students will appear here once you are assigned.</p>
          )}

          {!error && teacherClasses.length > 0 && (
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
