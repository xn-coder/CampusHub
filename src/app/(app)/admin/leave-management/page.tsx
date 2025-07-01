"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StoredLeaveApplicationDB } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getLeaveRequestsAction } from '@/actions/leaveActions';
import { format, parseISO } from 'date-fns';
import { ClipboardCheck, Loader2, CheckCircle, XCircle, User, CalendarDays, MessageSquare, ExternalLink } from 'lucide-react';

export default function AdminLeaveManagementPage() {
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<StoredLeaveApplicationDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (!adminUserId) {
        toast({ title: "Error", description: "Admin not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { data: adminUser, error: userError } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', adminUserId)
        .single();
      
      if (userError || !adminUser || !adminUser.school_id) {
        toast({ title: "Error", description: "Could not fetch admin profile or school info.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const result = await getLeaveRequestsAction({ 
        school_id: adminUser.school_id, 
        target_role: 'teacher'
      });

      if (result.ok) {
        setLeaveRequests(result.applications || []);
      } else {
        toast({ title: "Error", description: result.message || "Failed to load leave requests.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    fetchRequests();
  }, [toast]);
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Teacher Leave Management" 
        description="Review and manage leave applications submitted by teachers." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardCheck className="mr-2 h-5 w-5" />Leave Applications from Teachers</CardTitle>
          <CardDescription>A log of teacher leave requests, sorted by most recent.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading leave requests...</div>
          ) : leaveRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No leave requests found from teachers.</p>
          ) : (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><User className="inline-block mr-1 h-4 w-4"/>Teacher Name</TableHead>
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
                    <TableCell className="font-medium">{req.applicant?.name || req.student_name}</TableCell>
                    <TableCell>{format(parseISO(req.submission_date), 'PP')}</TableCell>
                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                    <TableCell>
                      {req.medical_notes_data_uri ? (
                        <a href={req.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">
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
      </Card>
    </div>
  );
}
