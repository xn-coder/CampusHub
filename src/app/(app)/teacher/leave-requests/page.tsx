"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { UserRole, Student, StoredLeaveApplicationDB, User } from '@/types';
import { useState, useEffect } from 'react';
import { ClipboardCheck, ExternalLink, User as UserIcon, CalendarDays, MessageSquare, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getLeaveRequestsAction } from '@/app/(app)/leave-application/actions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';


export default function TeacherLeaveRequestsPage() {
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<StoredLeaveApplicationDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null); // Teacher Profile ID
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeacherAndLeaveData() {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        const teacherUserId = localStorage.getItem('currentUserId'); // This is User.id

        if (!teacherUserId) {
          toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        
        // Get Teacher Profile ID and School ID
        const { data: teacherProfile, error: profileError } = await supabase
          .from('teachers')
          .select('id, school_id') // 'id' here is the teacher's profile ID
          .eq('user_id', teacherUserId)
          .single();

        if (profileError || !teacherProfile) {
          toast({ title: "Error", description: "Could not load teacher profile.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        setCurrentTeacherId(teacherProfile.id);
        setCurrentSchoolId(teacherProfile.school_id);

        if (teacherProfile.id && teacherProfile.school_id) {
          const result = await getLeaveRequestsAction({ school_id: teacherProfile.school_id, teacher_id: teacherProfile.id });
          if (result.ok && result.applications) {
            setLeaveRequests(result.applications);
          } else {
            toast({ title: "Error", description: result.message || "Failed to fetch leave requests.", variant: "destructive" });
            setLeaveRequests([]);
          }
        }
      }
      setIsLoading(false);
    }
    fetchTeacherAndLeaveData();
  }, [toast]);

  if (isLoading && !currentTeacherId) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading data...</span></div>;
  }
   if (!currentTeacherId || !currentSchoolId) {
       return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Student Leave Requests" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association.
        </CardContent></Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Leave Requests" 
        description="View and manage leave applications submitted by students in your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardCheck className="mr-2 h-5 w-5" />Leave Applications for Your Students</CardTitle>
          <CardDescription>Review AI-processed leave requests. For overrides or issues, contact administration.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading leave requests...</div>
          ) : leaveRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No leave requests found from students in your classes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><UserIcon className="inline-block mr-1 h-4 w-4"/>Student Name</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Submitted</TableHead>
                  <TableHead><MessageSquare className="inline-block mr-1 h-4 w-4"/>Reason</TableHead>
                  <TableHead>Medical Note</TableHead>
                  <TableHead className="text-center">AI Decision</TableHead>
                  <TableHead>AI Reasoning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.student_name}</TableCell>
                    <TableCell>{format(parseISO(req.submission_date), 'PPpp')}</TableCell>
                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                    <TableCell>
                      {req.medical_notes_data_uri ? (
                        <a href={req.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View Note <ExternalLink className="inline-block ml-1 h-3 w-3"/>
                        </a>
                      ) : (
                        'None'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Rejected' ? 'destructive' : 'secondary'}>
                        {req.status === 'Approved' && <CheckCircle className="inline-block mr-1 h-3 w-3"/>}
                        {req.status === 'Rejected' && <XCircle className="inline-block mr-1 h-3 w-3"/>}
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-xs">{req.ai_reasoning || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Leave applications are automatically processed by an AI based on school policy. Teachers can view the status here.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
