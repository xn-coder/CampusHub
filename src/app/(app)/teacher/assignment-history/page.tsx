
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Assignment, ClassData } from '@/types';
import { useState, useEffect } from 'react';
import { ScrollText, CalendarDays, ClipboardList, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MOCK_ASSIGNMENTS_KEY = 'mockAssignmentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';

export default function TeacherAssignmentHistoryPage() {
  const [postedAssignments, setPostedAssignments] = useState<Assignment[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedAssignments = localStorage.getItem(MOCK_ASSIGNMENTS_KEY);
      const allAssignments: Assignment[] = storedAssignments ? JSON.parse(storedAssignments) : [];
      
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setAllClasses(storedClasses ? JSON.parse(storedClasses) : []);

      if (teacherId) {
        const teacherSpecificAssignments = allAssignments
          .filter(asm => asm.teacherId === teacherId)
          .sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime()); // Sort by newest due date first
        setPostedAssignments(teacherSpecificAssignments);
      }
      setIsLoading(false);
    }
  }, []);

  const getClassSectionName = (classSectionId: string): string => {
    const cls = allClasses.find(c => c.id === classSectionId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Posted Assignment History" 
        description="View a record of all assignments you have posted." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ScrollText className="mr-2 h-5 w-5" /> Assignment Log</CardTitle>
          <CardDescription>Assignments you've created, sorted by newest due date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading assignment history...</p>
          ) : !currentTeacherId ? (
             <p className="text-destructive text-center py-4">Could not identify teacher. Please log in again.</p>
          ) : postedAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">You have not posted any assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ClipboardList className="inline-block mr-1 h-4 w-4"/>Title</TableHead>
                  <TableHead>Target Class</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Due Date</TableHead>
                  <TableHead><Info className="inline-block mr-1 h-4 w-4"/>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postedAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.title}</TableCell>
                    <TableCell>{getClassSectionName(assignment.classSectionId)}</TableCell>
                    <TableCell>{format(parseISO(assignment.dueDate), 'PP')}</TableCell>
                    <TableCell className="max-w-md truncate">{assignment.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {postedAssignments.length > 0 && (
            <CardFooter>
                <p className="text-xs text-muted-foreground">This log helps you keep track of all assignments created.</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
