
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { TCRequest, Student } from '@/types';
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getTCRequestsForSchoolAction, approveTCRequestAction, rejectTCRequestAction } from './actions';
import { format, parseISO } from 'date-fns';
import { CheckCircle, FileText, Loader2, XCircle, Ban, TextSelect } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    return null;
  }
  return school.id;
}


export default function AdminTCRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<TCRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<TCRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getTCRequestsForSchoolAction(schoolId);
    if (result.ok && result.requests) {
      setRequests(result.requests);
    } else {
      toast({ title: "Error", description: result.message || "Failed to load TC requests.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      getAdminSchoolId(adminUserId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchRequests(schoolId);
        } else {
          setIsLoading(false);
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
        }
      });
    } else {
      setIsLoading(false);
    }
  }, [fetchRequests, toast]);

  const handleApprove = async (requestId: string) => {
    setIsSubmitting(true);
    const result = await approveTCRequestAction(requestId);
    if (result.ok) {
        toast({ title: "Request Approved", description: result.message });
        if(currentSchoolId) fetchRequests(currentSchoolId);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleOpenRejectDialog = (request: TCRequest) => {
    setRequestToReject(request);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestToReject || !rejectionReason.trim()) return;
    setIsSubmitting(true);
    const result = await rejectTCRequestAction({ requestId: requestToReject.id, reason: rejectionReason });
     if (result.ok) {
        toast({ title: "Request Rejected", description: result.message, variant: "destructive" });
        if(currentSchoolId) fetchRequests(currentSchoolId);
        setIsRejectDialogOpen(false);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transfer Certificate Requests"
        description="Review and process TC requests submitted by students."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TextSelect className="mr-2 h-5 w-5" />Pending & Processed Requests</CardTitle>
          <CardDescription>A log of all TC requests. Approve to allow students to download their certificate.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No Transfer Certificate requests found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const student = req.student as Student & { class: { name: string, division: string }};
                  return (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.class ? `${student.class.name} - ${student.class.division}` : 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(req.request_date), 'PP')}</TableCell>
                    <TableCell>
                      <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Rejected' ? 'destructive' : 'secondary'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      {req.status === 'Pending' ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleApprove(req.id)} disabled={isSubmitting}>
                            <CheckCircle className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleOpenRejectDialog(req)} disabled={isSubmitting}>
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </>
                      ) : req.status === 'Approved' ? (
                        <span className="text-sm text-green-600">Approved on {format(parseISO(req.approved_date!), 'PP')}</span>
                      ) : (
                        <span className="text-sm text-red-600 truncate" title={req.rejection_reason || ''}>
                            Rejected: {req.rejection_reason}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject TC Request for {requestToReject?.student.name}</DialogTitle>
                <DialogDescription>Please provide a reason for rejecting this request. The reason will be visible to the student.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReject}>
                <div className="py-4">
                    <Label htmlFor="rejectionReason">Reason for Rejection</Label>
                    <Textarea id="rejectionReason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required disabled={isSubmitting} placeholder="e.g., Outstanding library dues."/>
                </div>
                 <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" variant="destructive" disabled={isSubmitting || !rejectionReason.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>} Reject Request
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
