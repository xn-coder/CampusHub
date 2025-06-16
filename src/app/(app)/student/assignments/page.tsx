
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Assignment } from '@/types';
import { useState, useEffect } from 'react';
import { ClipboardList, CalendarClock, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isPast } from 'date-fns';
import { getStudentAssignmentsAction } from './actions'; // Import the server action

interface EnrichedAssignmentClient extends Assignment {
  teacherName?: string;
  subjectName?: string;
}

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const [myAssignments, setMyAssignments] = useState<EnrichedAssignmentClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
      setIsLoading(true);
      setPageMessage(null);
      const currentUserId = localStorage.getItem('currentUserId');
      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified. Cannot load assignments.", variant: "destructive" });
        setIsLoading(false);
        setPageMessage("User not identified.");
        return;
      }

      const result = await getStudentAssignmentsAction(currentUserId);

      if (result.ok) {
        setMyAssignments(result.assignments || []);
        if (result.assignments && result.assignments.length === 0) {
          if (!result.studentClassId || !result.studentSchoolId) {
             setPageMessage("Your student profile is missing class or school information. Please contact administration.");
          } else {
             setPageMessage("No assignments posted for your class yet.");
          }
        }
      } else {
        toast({ title: "Error Loading Assignments", description: result.message, variant: "destructive" });
        setMyAssignments([]);
        setPageMessage(result.message || "Failed to load assignments.");
      }
      setIsLoading(false);
    }
    fetchAssignments();
  }, [toast]); 

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
      ) : pageMessage ? (
         <Card><CardContent className="pt-6 text-center text-muted-foreground">{pageMessage}</CardContent></Card>
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
    