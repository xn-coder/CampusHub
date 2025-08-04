
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ClassData, Student } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { School, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTeacherClassesDataAction } from './actions';

interface EnrichedClassData extends ClassData {
  students: Student[];
}

export default function MyClassesPage() {
  const { toast } = useToast();
  const [assignedClassesWithStudents, setAssignedClassesWithStudents] = useState<EnrichedClassData[]>([]);
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

    const result = await getTeacherClassesDataAction(teacherUserId);

    if (result.ok) {
      setAssignedClassesWithStudents(result.classesWithStudents || []);
    } else {
      setError(result.message || "An unknown error occurred.");
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      {assignedClassesWithStudents.length === 0 && !isLoading && (
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
                          <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
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
