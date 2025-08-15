
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StoredLeaveApplicationDB } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getLeaveRequestsAction, updateLeaveStatusAction } from '@/actions/leaveActions';
import { format, parseISO } from 'date-fns';
import { ClipboardCheck, Loader2, CheckCircle, XCircle, User, CalendarDays, MessageSquare, History, BarChart3, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";


interface LeaveSummary {
    applicantId: string;
    applicantName: string;
    role: 'Teacher' | 'Student';
    totalAllotted: number; // Assumed value for demonstration
    leavesTaken: number;
    balance: number;
}

export default function AdminLeaveManagementPage() {
  const { toast } = useToast();
  const [allLeaveRequests, setAllLeaveRequests] = useState<StoredLeaveApplicationDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const fetchRequests = async (schoolId: string) => {
      setIsLoading(true);
      const [teacherResult, studentResult] = await Promise.all([
        getLeaveRequestsAction({ school_id: schoolId, target_role: 'teacher' }),
        getLeaveRequestsAction({ school_id: schoolId, target_role: 'student' })
      ]);
      
      let allRequests: StoredLeaveApplicationDB[] = [];
      if (teacherResult.ok && teacherResult.applications) {
        allRequests = allRequests.concat(teacherResult.applications);
      } else {
        toast({ title: "Error", description: teacherResult.message || "Failed to load teacher leave requests.", variant: "destructive" });
      }
      
      if (studentResult.ok && studentResult.applications) {
        allRequests = allRequests.concat(studentResult.applications);
      } else {
        toast({ title: "Error", description: studentResult.message || "Failed to load student leave requests.", variant: "destructive" });
      }
      setAllLeaveRequests(allRequests.sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime()));
      setIsLoading(false);
  }

  useEffect(() => {
    async function loadContextAndData() {
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
      setCurrentSchoolId(adminUser.school_id);
      await fetchRequests(adminUser.school_id);
    }
    loadContextAndData();
  }, [toast]);
  
  const handleUpdateStatus = async (requestId: string, status: 'Approved' | 'Rejected') => {
    if (!currentSchoolId) return;
    setIsLoading(true);
    const result = await updateLeaveStatusAction({ requestId, status, schoolId: currentSchoolId });
    if(result.ok) {
        toast({title: "Status Updated", description: result.message});
        fetchRequests(currentSchoolId);
    } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
        setIsLoading(false);
    }
  }

  const leaveSummaryData = useMemo(() => {
    const summaryMap: Record<string, LeaveSummary> = {};
    const ASSUMED_ALLOTTED_LEAVES = 3;

    allLeaveRequests.forEach(req => {
        if (!summaryMap[req.applicant_user_id]) {
            summaryMap[req.applicant_user_id] = {
                applicantId: req.applicant_user_id,
                applicantName: req.student_name,
                role: req.applicant_role === 'teacher' ? 'Teacher' : 'Student',
                totalAllotted: ASSUMED_ALLOTTED_LEAVES,
                leavesTaken: 0,
                balance: ASSUMED_ALLOTTED_LEAVES
            };
        }
        if (req.status === 'Approved') {
            summaryMap[req.applicant_user_id].leavesTaken += 1;
            summaryMap[req.applicant_user_id].balance -=1;
        }
    });
    return Object.values(summaryMap);
  }, [allLeaveRequests]);

  const pendingRequests = useMemo(() => {
    return allLeaveRequests.filter(req => req.status === 'Pending');
  }, [allLeaveRequests]);


  const renderLeaveTable = (requests: StoredLeaveApplicationDB[], type: 'Teacher' | 'Student' | 'All') => {
    const filteredRequests = type === 'All' ? requests : requests.filter(r => r.applicant_role === type.toLowerCase());
    
    return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead><User className="inline-block mr-1 h-4 w-4"/>Applicant</TableHead>
          <TableHead>Role</TableHead>
          <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Submitted</TableHead>
          <TableHead><MessageSquare className="inline-block mr-1 h-4 w-4"/>Reason</TableHead>
          <TableHead>Medical Note</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredRequests.map((req) => (
          <TableRow key={req.id}>
            <TableCell className="font-medium">{req.student_name}</TableCell>
            <TableCell className="capitalize">{req.applicant_role}</TableCell>
            <TableCell>{format(parseISO(req.submission_date), 'PP')}</TableCell>
            <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
            <TableCell>
              {req.medical_notes_data_uri ? (
                <a href={req.medical_notes_data_uri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">
                  View Note <ExternalLink className="inline-block ml-1 h-3 w-3"/>
                </a>
              ) : ( 'None' )}
            </TableCell>
            <TableCell>
              <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Rejected' ? 'destructive' : 'secondary'}>
                {req.status === 'Approved' && <CheckCircle className="inline-block mr-1 h-3 w-3"/>}
                {req.status === 'Rejected' && <XCircle className="inline-block mr-1 h-3 w-3"/>}
                {req.status === 'Pending' && <Clock className="inline-block mr-1 h-3 w-3"/>}
                {req.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
                {req.status === 'Pending' && (
                    <>
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(req.id, 'Approved')} disabled={isLoading}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(req.id, 'Rejected')} disabled={isLoading}>Reject</Button>
                    </>
                )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Leave Management & Reports" 
        description="Review leave applications, view summaries, and manage pending requests." 
      />
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending Approvals ({pendingRequests.length})</TabsTrigger>
          <TabsTrigger value="summary">Summary Report</TabsTrigger>
          <TabsTrigger value="transactions">Transaction Log</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5" />Pending Leave Requests</CardTitle>
                  <CardDescription>All leave applications awaiting your review and action.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading requests...</div>
                ) : pendingRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No pending leave requests.</p>
                ) : renderLeaveTable(pendingRequests, 'All')}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="summary">
             <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" />Employee Leave Summary</CardTitle>
                  <CardDescription>An overview of approved leave balances. Allotted leaves are assumed to be 3 for this report.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                      <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading summary...</div>
                  ) : leaveSummaryData.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No approved leave data to summarize.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-center">Total Allotted</TableHead>
                          <TableHead className="text-center">Leaves Taken</TableHead>
                          <TableHead className="text-center">Remaining Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaveSummaryData.map((summary) => (
                          <TableRow key={summary.applicantId}>
                            <TableCell className="font-medium">{summary.applicantName}</TableCell>
                            <TableCell>{summary.role}</TableCell>
                            <TableCell className="text-center">{summary.totalAllotted}</TableCell>
                            <TableCell className="text-center">{summary.leavesTaken}</TableCell>
                            <TableCell className="text-center font-bold">{summary.balance}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
            </Card>
        </TabsContent>
         <TabsContent value="transactions">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" />Full Leave Transaction Log</CardTitle>
                  <CardDescription>A complete history of all leave requests, sorted by most recent.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading transactions...</div>
                ) : allLeaveRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No leave transactions found.</p>
                ) : renderLeaveTable(allLeaveRequests, 'All')}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
