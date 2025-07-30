
"use client";

import PageHeader from '@/components/shared/page-header';
import LeaveForm from '@/components/leave-application/leave-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StoredLeaveApplicationDB, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getLeaveRequestsAction } from '@/actions/leaveActions';
import { format, parseISO, isValid } from 'date-fns';
import { History, Loader2, CheckCircle, XCircle, PlusCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


export default function LeaveApplicationPage() {
  const { toast } = useToast();
  const [leaveHistory, setLeaveHistory] = useState<StoredLeaveApplicationDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      const role = localStorage.getItem('currentUserRole') as UserRole | null;
      setCurrentUserRole(role);
      
      if (role !== 'teacher') {
          setIsLoading(false);
          return; // Only teachers see their history here
      }
      setIsLoading(true);
      const teacherUserId = localStorage.getItem('currentUserId');
      if (!teacherUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const { data: userRec } = await supabase.from('users').select('school_id').eq('id', teacherUserId).single();
      if (!userRec || !userRec.school_id) {
          toast({title: "Error", description: "Could not determine your school.", variant: "destructive"});
          setIsLoading(false);
          return;
      }

      const result = await getLeaveRequestsAction({ 
        school_id: userRec.school_id, 
        applicant_user_id: teacherUserId,
        target_role: 'teacher'
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

  const handleApplicationSuccess = () => {
    setIsFormOpen(false); // Close the dialog
    // Re-fetch data
    async function fetchHistory() {
      const teacherUserId = localStorage.getItem('currentUserId');
      const { data: userRec } = await supabase.from('users').select('school_id').eq('id', teacherUserId!).single();
      if (userRec?.school_id) {
          const result = await getLeaveRequestsAction({ 
              school_id: userRec.school_id, 
              applicant_user_id: teacherUserId!,
              target_role: 'teacher'
          });
          if (result.ok) setLeaveHistory(result.applications || []);
      }
    }
    fetchHistory();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Leave Management" 
        description="Submit and manage your leave requests."
        actions={
            currentUserRole === 'teacher' ? (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Application
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <LeaveForm onApplicationSubmitted={handleApplicationSuccess} />
                    </DialogContent>
                </Dialog>
            ) : (
                // Students see the form directly on the page if they land here
                null
            )
        }
      />
      
      {currentUserRole === 'teacher' ? (
        <Card>
            <CardHeader>
            <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" />My Leave History</CardTitle>
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
                            <span className="font-medium text-left truncate" title={request.reason}>
                                {request.reason}
                            </span>
                            <div className="flex items-center gap-4 ml-4 shrink-0">
                                <span className="text-sm text-muted-foreground">{format(parseISO(request.submission_date), 'PP')}</span>
                                <Badge variant={request.status === 'Approved' ? 'default' : request.status === 'Rejected' ? 'destructive' : 'secondary'}>
                                    {request.status === 'Approved' ? <CheckCircle className="mr-1 h-3 w-3" /> : request.status === 'Pending' ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <XCircle className="mr-1 h-3 w-3" />}
                                    {request.status}
                                </Badge>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-2 text-sm text-muted-foreground px-4 py-2 border-l-2 ml-2">
                            <p><strong>Submitted On:</strong> {formatDateSafe(request.submission_date)}</p>
                            <p><strong>Reason Provided:</strong> {request.reason}</p>
                            <p><strong>Medical Note:</strong> {request.medical_notes_data_uri ? <a href={request.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Note</a> : 'Not provided'}</p>
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            )}
            </CardContent>
        </Card>
      ) : (
        <LeaveForm />
      )}
    </div>
  );
}
