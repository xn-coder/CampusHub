
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, FeeCategory, User } from '@/types';
import { DollarSign, CalendarDays, FileText, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getStudentPaymentHistoryAction } from '@/app/(app)/admin/student-fees/actions'; // Re-use if appropriate or create student specific
import { format, parseISO, isValid } from 'date-fns';


export default function StudentPaymentHistoryPage() {
    const { toast } = useToast();
    const [payments, setPayments] = useState<StudentFeePayment[]>([]);
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentStudentProfileId, setCurrentStudentProfileId] = useState<string | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


    useEffect(() => {
        async function loadPaymentData() {
            setIsLoading(true);
            const studentUserId = localStorage.getItem('currentUserId');
            if (!studentUserId) {
                toast({ title: "Error", description: "Student not identified.", variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const { data: studentProfile, error: profileError } = await supabase
                .from('students')
                .select('id, school_id') // students.id is the student_profile_id
                .eq('user_id', studentUserId)
                .single();

            if (profileError || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
                toast({ title: "Error", description: "Could not fetch student profile or school information.", variant: "destructive"});
                setIsLoading(false);
                return;
            }
            setCurrentStudentProfileId(studentProfile.id);
            setCurrentSchoolId(studentProfile.school_id);
            
            const result = await getStudentPaymentHistoryAction(studentProfile.id, studentProfile.school_id);
            if (result.ok) {
                setPayments(result.payments || []);
                setFeeCategories(result.feeCategories || []);
            } else {
                toast({ title: "Error fetching payment history", description: result.message, variant: "destructive"});
            }
            setIsLoading(false);
        }
        loadPaymentData();
    }, [toast]);

    const getFeeCategoryName = (categoryId: string) => {
        return feeCategories.find(fc => fc.id === categoryId)?.name || 'N/A';
    };
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'N/A';
    };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Payment History" 
        description="View your fee payments, transaction details, and payment statuses." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />My Fee Payment Records</CardTitle>
          <CardDescription>A history of all your financial transactions with the school.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading payment history...</div>
          ) : !currentStudentProfileId ? (
             <p className="text-destructive text-center py-4">Could not load student profile. Payment history unavailable.</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payment records found for you.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><FileText className="inline-block mr-1 h-4 w-4" />Fee Category</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Due Date</TableHead>
                  <TableHead className="text-right">Assigned ($)</TableHead>
                  <TableHead className="text-right">Paid ($)</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Payment Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{getFeeCategoryName(payment.fee_category_id)}</TableCell>
                    <TableCell>{formatDateSafe(payment.due_date)}</TableCell>
                    <TableCell className="text-right">${payment.assigned_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${payment.paid_amount.toFixed(2)}</TableCell>
                    <TableCell>{formatDateSafe(payment.payment_date)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={
                        payment.status === 'Paid' ? 'default' :
                        payment.status === 'Partially Paid' ? 'secondary' :
                        payment.status === 'Overdue' ? 'destructive' : 
                        'outline'
                      }>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-xs">{payment.notes || 'N/A'}</TableCell>
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
    