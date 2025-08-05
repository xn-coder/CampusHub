

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, FeeCategory, Student, AcademicYear } from '@/types';
import { DollarSign, FileText, Loader2, CreditCard, Download, FolderOpen } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getStudentPaymentHistoryAction, createRazorpayOrderAction, verifyRazorpayPaymentAction } from '@/app/(app)/admin/student-fees/actions';
import { format, parseISO, isValid, isPast, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import Script from 'next/script';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function StudentPaymentHistoryPage() {
    const { toast } = useToast();
    const [payments, setPayments] = useState<StudentFeePayment[]>([]);
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    
    const [currentStudentProfile, setCurrentStudentProfile] = useState<Student | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

    const loadPaymentData = useCallback(async () => {
        const studentUserId = localStorage.getItem('currentUserId');
        if (!studentUserId) {
            toast({ title: "Error", description: "Student not identified.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const result = await getStudentPaymentHistoryAction(studentUserId);
        
        if (result.ok) {
            setPayments(result.payments || []);
            setFeeCategories(result.feeCategories || []);
            setAcademicYears(result.academicYears || []);
            setCurrentStudentProfile(result.studentProfile || null);
            setCurrentSchoolId(result.studentProfile?.school_id || null);
        } else {
            toast({ title: "Error fetching payment history", description: result.message, variant: "destructive"});
        }
        setIsLoading(false);
    }, [toast]);
    
    useEffect(() => {
        loadPaymentData();
    }, [loadPaymentData]);

    const totalDue = useMemo(() => {
      return payments
        .filter(p => p.status !== 'Paid')
        .reduce((acc, payment) => acc + (payment.assigned_amount - payment.paid_amount), 0);
    }, [payments]);

    const initiatePayment = async (amountToPay: number, feeIds: string[], description: string) => {
        if (!currentStudentProfile || !currentSchoolId) {
            toast({ title: 'Error', description: 'User context is missing.', variant: 'destructive' });
            return;
        }

        setIsPaying(true);

        const amountInPaisa = Math.round(amountToPay * 100);

        const orderResult = await createRazorpayOrderAction(amountInPaisa, feeIds, currentStudentProfile.id, currentSchoolId);

        if (!orderResult.ok) {
            toast({ title: 'Payment Error', description: orderResult.message || 'Could not create payment order.', variant: 'destructive' });
            setIsPaying(false);
            return;
        }
        
        if (orderResult.isMock) {
            toast({ title: "Payment Successful", description: orderResult.message });
            await loadPaymentData();
            setIsPaying(false);
            return;
        }

        if (orderResult.order) {
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: orderResult.order.amount,
                currency: "INR",
                name: "CampusHub Fee Payment",
                description: description,
                order_id: orderResult.order.id,
                handler: async (response: any) => {
                    const verifyResult = await verifyRazorpayPaymentAction(
                        response.razorpay_payment_id,
                        response.razorpay_order_id,
                        response.razorpay_signature,
                        currentSchoolId!
                    );
                    if (verifyResult.ok) {
                        toast({ title: 'Payment Successful', description: verifyResult.message });
                        await loadPaymentData();
                    } else {
                        toast({ title: 'Payment Failed', description: verifyResult.message, variant: 'destructive' });
                    }
                },
                prefill: {
                    name: currentStudentProfile.name,
                    email: currentStudentProfile.email,
                },
                notes: {
                    student_id: currentStudentProfile.id,
                },
                theme: {
                    color: "#3399cc"
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any){
                console.error(response);
                toast({
                    title: 'Payment Failed',
                    description: `Code: ${response.error.code}, Reason: ${response.error.reason}`,
                    variant: 'destructive',
                });
            });
            
            rzp.open();
        }
        setIsPaying(false);
    };

    const handlePayFee = (payment: StudentFeePayment) => {
        const dueAmount = payment.assigned_amount - payment.paid_amount;
        if (dueAmount > 0) {
            initiatePayment(dueAmount, [payment.id], `Payment for ${getFeeCategoryName(payment.fee_category_id)}`);
        }
    };
    
    const handlePayAllFees = () => {
        if (totalDue <= 0) return;
        const feeIdsToPay = payments
            .filter(p => p.status !== 'Paid')
            .map(p => p.id);
        initiatePayment(totalDue, feeIdsToPay, 'Payment for all outstanding fees');
    };

    const getFeeCategoryName = (categoryId: string) => {
        return feeCategories.find(fc => fc.id === categoryId)?.name || 'N/A';
    };

    const getAcademicYearName = useCallback((yearId?: string | null) => {
        if (!yearId) return 'General';
        const year = academicYears.find(ay => ay.id === yearId);
        return year ? year.name : 'N/A';
    }, [academicYears]);
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
    };


  return (
    <>
      <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="flex flex-col gap-6">
        <PageHeader 
          title="My Payment History" 
          description="View your fee payments, transaction details, and payment statuses." 
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />Fee Payment Records</CardTitle>
            <CardDescription>A detailed list of all assigned fees.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading payment history...</div>
            ) : !currentStudentProfile ? (
              <p className="text-destructive text-center py-4">Could not load student profile. Payment history unavailable.</p>
            ) : payments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No payment records found for you.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fee Category</TableHead>
                            <TableHead>Academic Year</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Assigned</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Due</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => {
                             const dueAmount = payment.assigned_amount - payment.paid_amount;
                            return (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-medium">{getFeeCategoryName(payment.fee_category_id)}</TableCell>
                                    <TableCell>{getAcademicYearName(payment.academic_year_id)}</TableCell>
                                    <TableCell>{formatDateSafe(payment.due_date)}</TableCell>
                                    <TableCell className="text-right font-mono">₹{payment.assigned_amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">₹{payment.paid_amount.toFixed(2)}</TableCell>
                                    <TableCell className={`text-right font-mono ${dueAmount > 0 ? 'text-destructive' : ''}`}>₹{dueAmount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            payment.status === 'Paid' ? 'default' :
                                            payment.status === 'Partially Paid' ? 'secondary' :
                                            payment.status === 'Overdue' ? 'destructive' : 
                                            'outline'
                                        }>
                                            {payment.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {payment.status !== 'Paid' && (
                                            <Button variant="outline" size="sm" onClick={() => handlePayFee(payment)} disabled={isPaying}>
                                                <CreditCard className="mr-1 h-3 w-3" /> Pay Now
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            )}
          </CardContent>
          {payments.length > 0 && !isLoading && (
              <CardFooter>
                  <div className="flex w-full items-center gap-4 pt-4 border-t flex-wrap justify-end">
                      <div className="flex-grow sm:flex-grow-0" />
                      <div className="text-right">
                          <p className="text-muted-foreground">Overall Amount Due</p>
                          <p className="text-2xl font-bold"><span className="font-mono">₹</span>{totalDue.toFixed(2)}</p>
                      </div>
                      {totalDue > 0 && (
                          <Button onClick={handlePayAllFees} disabled={isPaying || isLoading}>
                              {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CreditCard className="mr-2 h-4 w-4"/>}
                              Pay All Due Fees
                          </Button>
                      )}
                  </div>
              </CardFooter>
          )}
        </Card>
      </div>
    </>
  );
}
