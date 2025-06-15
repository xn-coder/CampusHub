
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { School, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface EnrichedClassData extends ClassData {
  students: Student[];
}

export default function MyClassesPage() {
  const [assignedClassesWithStudents, setAssignedClassesWithStudents] = useState<EnrichedClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  useEffect(() => {
    const teacherId = localStorage.getItem('currentUserId');
    const role = localStorage.getItem('currentUserRole') as UserRole | null;

    if (!teacherId || role !== 'teacher') {
      setError("Access denied. You must be logged in as a teacher.");
      setIsLoading(false);
      return;
    }
    setCurrentTeacherId(teacherId);

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      // Get teacher's school_id from their profile
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teachers')
        .select('school_id')
        .eq('user_id', teacherId) // Assuming teacher profiles use user_id from users table
        .single();

      if (teacherError || !teacherProfile) {
        setError("Could not fetch teacher profile or school information.");
        setIsLoading(false);
        return;
      }
      setCurrentSchoolId(teacherProfile.school_id);
      const schoolId = teacherProfile.school_id;

      // Fetch classes assigned to this teacher in this school
      const { data: teacherClassesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, division, class_name_id, section_name_id, teacher_id, academic_year_id, school_id') // Specify needed fields
        .eq('teacher_id', teacherId) // Query by teacher's profile ID if classes.teacher_id stores that
        .eq('school_id', schoolId);
      
      if (classesError) {
        setError(`Failed to load classes: ${classesError.message}`);
        setIsLoading(false);
        return;
      }
      
      if (!teacherClassesData || teacherClassesData.length === 0) {
        setAssignedClassesWithStudents([]);
        setIsLoading(false);
        return;
      }
      
      // Fetch all students for the school to filter locally (can be optimized for larger schools)
      const { data: allStudentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, email, class_id, profile_picture_url, user_id, school_id')
        .eq('school_id', schoolId);

      if (studentsError) {
        setError(`Failed to load students: ${studentsError.message}`);
        setIsLoading(false);
        return;
      }

      const enrichedClasses = teacherClassesData.map(cls => {
        const studentsInClass = (allStudentsData || []).filter(student => student.class_id === cls.id);
        // Map to ClassData type, studentIds is for UI convenience, not directly from DB 'classes' table like this
        const classDataTyped: ClassData = {
            id: cls.id,
            name: cls.name,
            division: cls.division,
            class_name_id: cls.class_name_id,
            section_name_id: cls.section_name_id,
            teacher_id: cls.teacher_id,
            academic_year_id: cls.academic_year_id,
            school_id: cls.school_id,
            studentIds: studentsInClass.map(s => s.id), // Populate studentIds array
        };
        return { ...classDataTyped, students: studentsInClass };
      });

      setAssignedClassesWithStudents(enrichedClasses);
      setIsLoading(false);
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My Classes & Students" />
            <Card><CardContent className="pt-6 text-center flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your classes...</CardContent></Card>
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My Classes & Students" />
            <Card><CardContent className="pt-6 text-center text-destructive">{error}</CardContent></Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Classes & Students" 
        description="View the classes you are assigned to and the students in each." 
      />
      {assignedClassesWithStudents.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">You are not currently assigned to any classes.</p>
          </CardContent>
        </Card>
      )}
      {assignedClassesWithStudents.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assignedClassesWithStudents.map(cls => (
            <Card key={cls.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <School className="mr-2 h-6 w-6 text-primary" /> 
                  {cls.name} - {cls.division}
                </CardTitle>
                <CardDescription>
                  {cls.students.length} student(s) enrolled.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {cls.students.length > 0 ? (
                  <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {cls.students.map(student => (
                      <li key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.profilePictureUrl || undefined} alt={student.name} data-ai-hint="person student" />
                          <AvatarFallback>{student.name.substring(0,1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{student.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No students currently enrolled in this class.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

