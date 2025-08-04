
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
import { getTCRequestsForSchoolAction } from './actions';
import { format, parseISO } from 'date-fns';
import { CheckCircle, FileText, Loader2, XCircle, Ban, TextSelect, Download } from 'lucide-react';
import Link from 'next/link';
import { getAdminSchoolIdAction } from '../academic-years/actions';


export default function AdminTCRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<TCRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

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
      getAdminSchoolIdAction(adminUserId).then(schoolId => {
        if (schoolId) {
          setCurrentSchoolId(schoolId);
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
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Issued Transfer Certificates"
        description="Review auto-approved Transfer Certificate requests."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TextSelect className="mr-2 h-5 w-5" />Certificate Issuance Log</CardTitle>
          <CardDescription>A log of all TCs that have been automatically issued to students upon request after their fees were cleared.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No Transfer Certificate requests have been made yet.</p>
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
                      {req.status === 'Approved' && (
                         <Button variant="outline" size="sm" asChild>
                           <Link href={`/admin/transfer-certificate?studentId=${student.id}`}>
                              <Download className="mr-1 h-3 w-3" /> View Certificate
                           </Link>
                         </Button>
                      )}
                       {req.status === 'Rejected' && (
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
    </div>
  );
}
