
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { BookOpen, Users, School } from 'lucide-react';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';

interface EnrichedClassData extends ClassData {
  students: Student[];
}

export default function MyClassesPage() {
  const [assignedClassesWithStudents, setAssignedClassesWithStudents] = useState<EnrichedClassData[]>([]);
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
        
        const teacherClasses = allActiveClasses.filter(cls => cls.teacherId === currentUserId);

        if (teacherClasses.length === 0) {
          setIsLoading(false);
          return;
        }

        const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
        const allStudents: Student[] = storedStudents ? JSON.parse(storedStudents) : [];

        const enrichedClasses = teacherClasses.map(cls => {
          const studentsInClass = allStudents.filter(student => student.classId === cls.id);
          return { ...cls, students: studentsInClass };
        });

        setAssignedClassesWithStudents(enrichedClasses);
      } catch (e) {
        console.error("Failed to load class/student data:", e);
        setError("An error occurred while loading your class information.");
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Classes & Students" 
        description="View the classes you are assigned to and the students in each." 
      />
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Loading your classes...</p>
          </CardContent>
        </Card>
      )}
      {error && (
         <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      )}
      {!isLoading && !error && assignedClassesWithStudents.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">You are not currently assigned to any classes.</p>
          </CardContent>
        </Card>
      )}
      {!isLoading && !error && assignedClassesWithStudents.length > 0 && (
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
                  <ul className="space-y-2">
                    {cls.students.map(student => (
                      <li key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person student" />
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
