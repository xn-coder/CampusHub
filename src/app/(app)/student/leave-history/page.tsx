
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
import { History, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    return isValid(date) ? format(date, 'PPpp') : 'Invalid Date';
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
            <Accordion type="single" collapsible className="w-full">
              {leaveHistory.map((request) => (
                <AccordionItem value={request.id} key={request.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between items-center w-full pr-4">
                        <span className="font-medium text-left basis-1/2 truncate" title={request.reason}>
                            {request.reason}
                        </span>
                        <div className="flex items-center gap-4 ml-4 shrink-0">
                            <span className="text-sm text-muted-foreground hidden sm:inline">{format(parseISO(request.submission_date), 'PP')}</span>
                             <Badge variant={request.status === 'Approved' ? 'default' : request.status === 'Rejected' ? 'destructive' : 'secondary'}>
                                {request.status === 'Approved' ? <CheckCircle className="mr-1 h-3 w-3" /> : request.status === 'Rejected' ? <XCircle className="mr-1 h-3 w-3" /> : <Loader2 className="mr-1 h-3 w-3 animate-spin"/>}
                                {request.status}
                            </Badge>
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground px-4 py-2 border-l-2 ml-2">
                        <p><strong>Submitted On:</strong> {formatDateSafe(request.submission_date)}</p>
                        <p className="whitespace-pre-wrap break-words"><strong>Reason Provided:</strong> {request.reason}</p>
                        <p><strong>Medical Note:</strong> {request.medical_notes_data_uri ? <a href={request.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Note <ExternalLink className="inline h-3 w-3"/></a> : 'Not provided'}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
