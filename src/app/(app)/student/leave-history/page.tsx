
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StoredLeaveApplicationDB } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getLeaveRequestsAction } from '@/actions/leaveActions';
import { format, parseISO, isValid } from 'date-fns';
import { History, Loader2, CheckCircle, XCircle, ExternalLink, MessageSquare, CalendarDays } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export default function StudentLeaveHistoryPage() {
  const { toast } = useToast();
  const [leaveHistory, setLeaveHistory] = useState<StoredLeaveApplicationDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setIsLoading(true);
      const studentUserId = localStorage.getItem('currentUserId');
      if (!studentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { data: studentProfile, error } = await supabase
        .from('students')
        .select('id, school_id')
        .eq('user_id', studentUserId)
        .single();
      
      if (error || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
        toast({ title: "Error", description: "Could not fetch student profile or school info.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const result = await getLeaveRequestsAction({ 
        school_id: studentProfile.school_id, 
        student_profile_id: studentProfile.id 
      });

      if (result.ok) {
        setLeaveHistory(result.applications || []);
      } else {
        toast({ title: "Error", description: result.message || "Failed to load leave history.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    fetchHistory();
  }, [toast]);
  
  const formatDateSafe = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Leave History" 
        description="View the status and details of all your submitted leave applications." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" />Submitted Applications</CardTitle>
          <CardDescription>A log of your leave requests, sorted by most recent.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your leave history...</div>
          ) : leaveHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">You have not submitted any leave requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Submitted</TableHead>
                    <TableHead><MessageSquare className="inline-block mr-1 h-4 w-4"/>Reason</TableHead>
                    <TableHead>Medical Note</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveHistory.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{formatDateSafe(req.submission_date)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={req.reason}>
                      {req.reason}
                    </TableCell>
                    <TableCell>
                      {req.medical_notes_data_uri ? (
                        <a href={req.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">
                          View Note <ExternalLink className="inline-block ml-1 h-3 w-3"/>
                        </a>
                      ) : ('None')}
                    </TableCell>
                    <TableCell>
                       <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Rejected' ? 'destructive' : 'secondary'}>
                        {req.status === 'Approved' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {req.status === 'Rejected' && <XCircle className="mr-1 h-3 w-3" />}
                        {req.status === 'Pending' && <Loader2 className="mr-1 h-3 w-3 animate-spin"/>}
                        {req.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
