
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, FeeCategory, ClassData } from '@/types';
import { DollarSign, CalendarDays, FileText, Loader2, CreditCard, Download, School } from 'lucide-react';
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getStudentPaymentHistoryAction, recordStudentFeePaymentAction, studentPayAllFeesAction } from '@/app/(app)/admin/student-fees/actions';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function StudentPaymentHistoryPage() {
    const { toast } = useToast();
    const [payments, setPayments] = useState<StudentFeePayment[]>([]);
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaying, setIsPaying] = useState(false);
    
    const [currentStudentProfileId, setCurrentStudentProfileId] = useState<string | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [currentStudentName, setCurrentStudentName] = useState<string | null>(null);

    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [paymentForAction, setPaymentForAction] = useState<StudentFeePayment | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');


    async function loadPaymentData() {
        if (currentStudentProfileId && currentSchoolId) {
            setIsLoading(true);
            const result = await getStudentPaymentHistoryAction(currentStudentProfileId, currentSchoolId);
            if (result.ok) {
                setPayments(result.payments || []);
                setFeeCategories(result.feeCategories || []);
            } else {
                toast({ title: "Error fetching payment history", description: result.message, variant: "destructive"});
            }
            setIsLoading(false);
        }
    }
    
    useEffect(() => {
        async function fetchInitialData() {
            setIsLoading(true);
            const studentUserId = localStorage.getItem('currentUserId');
            if (!studentUserId) {
                toast({ title: "Error", description: "Student not identified.", variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const { data: studentProfile, error: profileError } = await supabase
                .from('students')
                .select('id, school_id, name')
                .eq('user_id', studentUserId)
                .single();
            
            if (profileError || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
                toast({ title: "Error", description: "Could not fetch student profile or school information.", variant: "destructive"});
                setIsLoading(false);
                return;
            }
            setCurrentStudentProfileId(studentProfile.id);
            setCurrentSchoolId(studentProfile.school_id);
            setCurrentStudentName(studentProfile.name);
            
            const paymentResult = await getStudentPaymentHistoryAction(studentProfile.id, studentProfile.school_id);

            if (paymentResult.ok) {
                setPayments(paymentResult.payments || []);
                setFeeCategories(paymentResult.feeCategories || []);
            } else {
                toast({ title: "Error fetching payment history", description: paymentResult.message, variant: "destructive"});
            }

            setIsLoading(false);
        }
        fetchInitialData();
    }, [toast]);
    
    const totalDue = useMemo(() => {
      return payments
          .filter(p => p.status !== 'Paid')
          .reduce((acc, p) => acc + (p.assigned_amount - p.paid_amount), 0);
    }, [payments]);

    const handleOpenPaymentDialog = (payment: StudentFeePayment) => {
        setPaymentForAction(payment);
        setPaymentAmount('');
        setIsPaymentDialogOpen(true);
    };

    const handlePayFeeSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!paymentForAction || !currentSchoolId || paymentAmount === '' || paymentAmount <= 0) {
            toast({ title: "Invalid Input", description: "Please enter a valid payment amount.", variant: "destructive" });
            return;
        }

        const amountDueForFee = paymentForAction.assigned_amount - paymentForAction.paid_amount;
        if (paymentAmount > amountDueForFee) {
            toast({ title: "Invalid Amount", description: `Payment cannot be more than the due amount of $${amountDueForFee.toFixed(2)}.`, variant: "destructive" });
            return;
        }

        setIsPaying(true);
        const result = await recordStudentFeePaymentAction({
            fee_payment_id: paymentForAction.id,
            payment_amount: Number(paymentAmount),
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            school_id: currentSchoolId,
        });

        if (result.ok) {
            toast({ title: "Payment Recorded", description: "Your payment has been successfully recorded." });
            await loadPaymentData();
            setIsPaymentDialogOpen(false);
        } else {
            toast({ title: "Payment Failed", description: result.message, variant: "destructive" });
        }
        setIsPaying(false);
    };

    const handlePayAllFees = async () => {
        if (!currentStudentProfileId || !currentSchoolId) {
            toast({ title: "Error", description: "Cannot process payment without student context.", variant: "destructive" });
            return;
        }
        if (totalDue <= 0) {
            toast({ title: "No Dues", description: "You have no outstanding fees to pay.", variant: "default" });
            return;
        }
        if (!confirm(`This will simulate paying the total due amount of $${totalDue.toFixed(2)}. Do you want to proceed?`)) {
            return;
        }

        setIsPaying(true);
        const result = await studentPayAllFeesAction(currentStudentProfileId, currentSchoolId);

        if (result.ok) {
            toast({ title: "Payment Successful", description: result.message });
            await loadPaymentData(); // Refresh data on success
        } else {
            toast({ title: "Payment Failed", description: result.message, variant: "destructive" });
        }
        setIsPaying(false);
    };


    const getFeeCategoryName = (categoryId: string) => {
        return feeCategories.find(fc => fc.id === categoryId)?.name || 'N/A';
    };
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
    };

    const handleDownloadHistory = () => {
        if (payments.length === 0) {
            toast({ title: "No Data", description: "There is no payment history to download.", variant: "destructive" });
            return;
        }

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Fee Payment History Statement", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Student: ${currentStudentName || 'N/A'}`, 14, 29);
        doc.text(`Date Generated: ${format(new Date(), 'PP')}`, 14, 34);

        const tableColumn = ["Fee Category", "Due Date", "Assigned ($)", "Paid ($)", "Payment Date", "Status"];
        const tableRows: (string | number)[][] = [];

        payments.forEach(payment => {
            const paymentData = [
                getFeeCategoryName(payment.fee_category_id),
                formatDateSafe(payment.due_date),
                payment.assigned_amount.toFixed(2),
                payment.paid_amount.toFixed(2),
                formatDateSafe(payment.payment_date),
                payment.status
            ];
            tableRows.push(paymentData);
        });
        
        autoTable(doc, {
            startY: 40,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [34, 197, 94] },
        });

        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(12);
        doc.text("Summary:", 14, finalY + 15);
        doc.setFontSize(10);
        const totalAssigned = payments.reduce((acc, p) => acc + p.assigned_amount, 0);
        const totalPaid = payments.reduce((acc, p) => acc + p.paid_amount, 0);
        doc.text(`Total Assigned: $${totalAssigned.toFixed(2)}`, 14, finalY + 22);
        doc.text(`Total Paid: $${totalPaid.toFixed(2)}`, 14, finalY + 28);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Due: $${totalDue.toFixed(2)}`, 14, finalY + 34);
        doc.setFont('helvetica', 'normal');

        doc.save(`payment_history_${(currentStudentName || 'student').replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

        toast({
            title: "Download Started",
            description: "Your payment history PDF is being downloaded."
        });
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
            <div className="space-y-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead><FileText className="inline-block mr-1 h-4 w-4" />Fee Category</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Assigned ($)</TableHead>
                        <TableHead className="text-right">Paid ($)</TableHead>
                        <TableHead className="text-right">Due ($)</TableHead>
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
                                    <TableCell>{formatDateSafe(payment.due_date)}</TableCell>
                                    <TableCell className="text-right">${payment.assigned_amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${payment.paid_amount.toFixed(2)}</TableCell>
                                    <TableCell className={`text-right font-semibold ${dueAmount > 0 ? 'text-destructive' : ''}`}>${dueAmount.toFixed(2)}</TableCell>
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
                                            <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(payment)} disabled={isPaying}>
                                                <CreditCard className="mr-1 h-3 w-3" /> Pay
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
         {payments.length > 0 && !isLoading && (
            <CardFooter>
                <div className="flex w-full items-center gap-4 pt-4 border-t flex-wrap justify-end">
                    <Button variant="outline" onClick={handleDownloadHistory} disabled={isLoading || isPaying}>
                        <Download className="mr-2 h-4 w-4" />
                        Download History
                    </Button>
                    <div className="flex-grow sm:flex-grow-0" />
                    <div className="text-right">
                        <p className="text-muted-foreground">Total Amount Due</p>
                        <p className="text-2xl font-bold">${totalDue.toFixed(2)}</p>
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Make a Payment</DialogTitle>
            {paymentForAction && (
                <DialogDescription>
                    Fee: {getFeeCategoryName(paymentForAction.fee_category_id)} <br/>
                    Amount Due: ${(paymentForAction.assigned_amount - paymentForAction.paid_amount).toFixed(2)}
                </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handlePayFeeSubmit}>
            <div className="grid gap-4 py-4">
                <div>
                    <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                    <Input
                        id="paymentAmount"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="Enter amount to pay"
                        required
                        step="0.01"
                        min="0.01"
                        max={(paymentForAction?.assigned_amount || 0) - (paymentForAction?.paid_amount || 0)}
                        disabled={isPaying}
                    />
                </div>
                <p className="text-xs text-muted-foreground">This simulates a real payment gateway for now. Enter a partial or full amount.</p>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" disabled={isPaying}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isPaying || !paymentAmount}>
                    {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CreditCard className="mr-2 h-4 w-4"/>}
                    {isPaying ? 'Processing...' : 'Submit Payment'}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
