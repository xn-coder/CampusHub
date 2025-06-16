
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Student, Teacher, Assignment, Subject } from '@/types';
import { useState, useEffect } from 'react';
import { ClipboardList, CalendarClock, Upload, CheckCircle, Loader2, BookOpenText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isPast } from 'date-fns';

interface EnrichedAssignment extends Assignment {
  teacherName?: string;
  subjectName?: string;
}

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const [myAssignments, setMyAssignments] = useState<EnrichedAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAssignments() {
      setIsLoading(true);
      const currentUserId = localStorage.getItem('currentUserId');
      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified. Cannot load assignments.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('class_id, school_id')
          .eq('user_id', currentUserId)
          .single();

        if (studentError || !studentData || !studentData.school_id || !studentData.class_id) {
          toast({
            title: "Cannot Load Assignments",
            description: "Your student profile is missing essential class or school information. Please contact administration.",
            variant: "destructive"
          });
          setMyAssignments([]);
          setIsLoading(false);
          return;
        }
        
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select('*')
          .eq('class_id', studentData.class_id)
          .eq('school_id', studentData.school_id)
          .order('due_date', { ascending: true });

        if (assignmentsError) {
          toast({ title: "Error", description: "Failed to fetch assignments. This might be due to access permissions.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (!assignmentsData || assignmentsData.length === 0) {
          setMyAssignments([]);
          setIsLoading(false);
          return;
        }

        const teacherIds = [...new Set(assignmentsData.map(a => a.teacher_id).filter(Boolean))];
        const subjectIds = [...new Set(assignmentsData.map(a => a.subject_id).filter(Boolean))];
        
        let teachers: Teacher[] = [];
        if (teacherIds.length > 0) {
            const { data: teachersData, error: teachersError } = await supabase
            .from('teachers')
            .select('id, name')
            .in('id', teacherIds);
            if (teachersError) console.error("Error fetching teachers for assignments:", teachersError);
            else teachers = teachersData || [];
        }
        
        let subjects: Subject[] = [];
        if (subjectIds.length > 0) {
            const { data: subjectsData, error: subjectsError } = await supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds);
            if (subjectsError) console.error("Error fetching subjects for assignments:", subjectsError);
            else subjects = subjectsData || [];
        }

        const enrichedAssignments = assignmentsData.map(asm => ({
          ...asm,
          teacherName: teachers.find(t => t.id === asm.teacher_id)?.name || 'N/A',
          subjectName: asm.subject_id ? subjects.find(s => s.id === asm.subject_id)?.name : undefined,
        }));

        setMyAssignments(enrichedAssignments);

      } catch (error: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive"});
      } finally {
        setIsLoading(false);
      }
    }
    fetchAssignments();
  }, []); 

  const handleMockSubmit = (assignmentId: string) => {
    toast({
        title: "Mock Submission",
        description: `Submission for assignment ID: ${assignmentId} would be handled here.`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Assignments" 
        description="View upcoming and past assignments for your classes." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your assignments...</CardContent></Card>
      ) : myAssignments.length === 0 ? (
         <Card><CardContent className="pt-6 text-center text-muted-foreground">No assignments posted for your class yet, or you might not be assigned to a class/school. If you believe this is an error, please ensure your class enrollment is correct and check your RLS policies on the 'assignments' table.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {myAssignments.map((assignment) => (
            <Card key={assignment.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{assignment.title}</CardTitle>
                  {isPast(parseISO(assignment.due_date)) ? (
                    <Badge variant="destructive">Past Due</Badge>
                  ) : (
                    <Badge variant="secondary">Upcoming</Badge>
                  )}
                </div>
                <CardDescription>
                  Posted by: {assignment.teacherName}
                  {assignment.subjectName && <span className="block text-xs">Subject: {assignment.subjectName}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2">
                <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Due: {format(parseISO(assignment.due_date), 'PPpp')}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => handleMockSubmit(assignment.id)} disabled={isPast(parseISO(assignment.due_date))}>
                  <Upload className="mr-2 h-4 w-4" /> Submit Assignment
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
