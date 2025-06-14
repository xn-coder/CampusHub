
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Student, ClassData, Teacher } from '@/types'; // Assuming Assignment type will be added to types
import { useState, useEffect } from 'react';
import { ClipboardList, CalendarClock, Upload, CheckCircle } from 'lucide-react';

// Define Assignment type locally or import from @/types if added there
interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string
  classSectionId: string;
  teacherId: string; // ID of the teacher who posted
  // Optional: fileUrl, submissionStatus, grade etc. for more features
}
const MOCK_ASSIGNMENTS_KEY = 'mockAssignmentsData'; // Assignments posted by teachers
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_TEACHERS_KEY = 'mockTeachersData'; // To get teacher name

export default function StudentAssignmentsPage() {
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const currentUserId = localStorage.getItem('currentUserId');
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      const allStudents: Student[] = storedStudents ? JSON.parse(storedStudents) : [];
      const currentStudent = allStudents.find(s => s.id === currentUserId);
      
      if (currentStudent?.classId) {
        setStudentClassId(currentStudent.classId);
        const storedAssignments = localStorage.getItem(MOCK_ASSIGNMENTS_KEY);
        const allAssignments: Assignment[] = storedAssignments ? JSON.parse(storedAssignments) : [];
        const relevantAssignments = allAssignments.filter(asm => asm.classSectionId === currentStudent.classId);
        setMyAssignments(relevantAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
      }

      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      setTeachers(storedTeachers ? JSON.parse(storedTeachers) : []);

      setIsLoading(false);
    }
  }, []);

  const getTeacherName = (teacherId: string): string => {
    return teachers.find(t => t.id === teacherId)?.name || 'N/A';
  };

  const isPastDue = (dueDate: string): boolean => {
    return new Date(dueDate) < new Date();
  };

  // Mock submission
  const handleMockSubmit = (assignmentId: string) => {
    alert(`Mock submission for assignment ID: ${assignmentId}. In a real app, this would open a file upload or text input.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Assignments" 
        description="View upcoming and past assignments for your classes." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading your assignments...</CardContent></Card>
      ) : myAssignments.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No assignments posted for your class yet.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {myAssignments.map((assignment) => (
            <Card key={assignment.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{assignment.title}</CardTitle>
                  {isPastDue(assignment.dueDate) ? (
                    <Badge variant="destructive">Past Due</Badge>
                  ) : (
                    <Badge variant="secondary">Upcoming</Badge>
                  )}
                </div>
                <CardDescription>
                  Posted by: {getTeacherName(assignment.teacherId)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2">
                <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Due: {new Date(assignment.dueDate).toLocaleDateString()}
                </div>
              </CardContent>
              <CardFooter>
                {/* Placeholder for submission status/action */}
                <Button variant="outline" size="sm" onClick={() => handleMockSubmit(assignment.id)} disabled={isPastDue(assignment.dueDate)}>
                  <Upload className="mr-2 h-4 w-4" /> Submit Assignment
                </Button>
                 {/* Example of submitted status - can be enhanced
                 <div className="flex items-center text-green-600 text-sm ml-auto">
                   <CheckCircle className="mr-1 h-4 w-4" /> Submitted
                 </div>
                 */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
