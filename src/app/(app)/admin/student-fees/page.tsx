
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, Student, FeeCategory, AcademicYear, ClassData, Installment, Concession } from '@/types';
import { DollarSign, Loader2, CreditCard, Save, ReceiptText, List } from 'lucide-react';
import { useState, useEffect, type FormEvent, useMemo, useCallback, Suspense, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, isPast, isToday } from 'date-fns';
import {
  recordStudentFeePaymentAction,
  fetchAdminSchoolIdForFees,
  getStudentsByClass,
} from './actions';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

const PAYMENT_METHODS = [
    "Cash", "Cheque", "Online", "Bank Transfer", "UPI", "Credit Card", "Debit Card"
];

function StudentFeesPageContent() {
  const { toast } = useToast();
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const refreshAllFeeData = useCallback(async (schoolId: string) => {
    // This function is now simplified as it doesn't need to load all summary data,
    // only what's necessary for the payment form (classes).
  }, []);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    setCurrentUserId(adminUserId);
    if (!adminUserId) {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoadingPage(false);
      return;
    }
    
    async function loadInitialData() {
      setIsLoadingPage(true);
      const schoolId = await fetchAdminSchoolIdForFees(adminUserId!);
      setCurrentSchoolId(schoolId);
      if (!schoolId) {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoadingPage(false);
    }
    loadInitialData();
  }, [toast, refreshAllFeeData]);

  if (isLoadingPage) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Student Payouts" />
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> <span>Loading...</span>
            </div>
        </div>
    );
  }
  
  if (!currentSchoolId) {
      return (
          <div className="flex flex-col gap-6">
            <PageHeader title="Student Payouts" description="Record fee payments for students." />
            <Card>
                <CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot record payments.</CardContent>
            </Card>
          </div>
      );
  }

  return (
    <div className="flex flex-col gap-6 min-h-screen">
      <PageHeader
        title="Student Payouts"
        description="Select a class and student to record full or partial fee payments."
        actions={
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline"><List className="mr-2 h-4 w-4" /> Payment Methods</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Available Payment Methods</DialogTitle>
                        <DialogDescription>
                            These are the currently supported payment methods you can select when recording a payment.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="list-disc list-inside space-y-2 py-4">
                        {PAYMENT_METHODS.map(method => <li key={method}>{method}</li>)}
                    </ul>
                    <DialogFooter>
                        <DialogClose asChild><Button>Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />Record Manual Payment</CardTitle>
          <CardDescription>Select a student to view their fees and record a payment.</CardDescription>
        </CardHeader>
        <CardContent>
            <RecordPaymentForm schoolId={currentSchoolId} />
        </CardContent>
      </Card>
    </div>
  );
}

function RecordPaymentForm({ schoolId }: { schoolId: string | null }) {
    const { toast } = useToast();
    const [isLoadingClasses, setIsLoadingClasses] = useState(false);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentFees, setStudentFees] = useState<StudentFeePayment[]>([]);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number | ''>>({});
    const [paymentModes, setPaymentModes] = useState<Record<string, string>>({});
    const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
    const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

    const loadClasses = useCallback(async () => {
        if (!schoolId) return;
        setIsLoadingClasses(true);
        const { data: classesData, error } = await supabase.from('classes').select('*').eq('school_id', schoolId);
        if (error) {
            toast({ title: 'Error', description: 'Failed to load classes.', variant: 'destructive' });
            setClasses([]);
        } else {
            setClasses(classesData || []);
        }
        setIsLoadingClasses(false);
    }, [schoolId, toast]);

    useEffect(() => {
        loadClasses();
    }, [loadClasses]);

    useEffect(() => {
        async function loadStudents() {
            if (!selectedClassId || !schoolId) {
                setStudents([]);
                setSelectedStudentId('');
                setStudentFees([]);
                return;
            }
            setIsFetchingStudents(true);
            const { data: studentsData, error } = await getStudentsByClass(schoolId, selectedClassId);
            if (error) toast({ title: 'Error', description: 'Failed to load students.', variant: 'destructive' });
            else setStudents(studentsData || []);
            setIsFetchingStudents(false);
        }
        loadStudents();
    }, [selectedClassId, schoolId, toast]);
    
    useEffect(() => {
        async function loadFees() {
            if (!selectedStudentId) {
                setStudentFees([]);
                return;
            }
            setIsFetchingFees(true);
            const { data, error } = await supabase
                .from('student_fee_payments')
                .select('*, fee_category:fee_category_id(name), installment:installment_id(title)')
                .eq('student_id', selectedStudentId)
                .order('due_date', { ascending: false });

            if (error) toast({ title: 'Error', description: 'Failed to load student fees.', variant: 'destructive' });
            else setStudentFees((data as any) || []);
            setIsFetchingFees(false);
        }
        loadFees();
    }, [selectedStudentId, toast]);

    const handlePayClick = async (feeId: string) => {
        const amount = paymentAmounts[feeId];
        const mode = paymentModes[feeId] || 'Cash';
        const notes = paymentNotes[feeId];

        if (typeof amount !== 'number' || amount <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a valid payment amount.', variant: 'destructive' });
            return;
        }
        
        setPayingFeeId(feeId);
        const result = await recordStudentFeePaymentAction({
            fee_payment_id: feeId,
            payment_amount: amount,
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            school_id: schoolId!,
            payment_mode: mode,
            notes: notes
        });

        if (result.ok) {
            toast({ title: 'Payment Recorded', description: 'The payment was successfully recorded.' });
            if (selectedStudentId) {
                const { data, error } = await supabase.from('student_fee_payments').select('*, fee_category:fee_category_id(name), installment:installment_id(title)').eq('student_id', selectedStudentId).order('due_date', { ascending: false });
                if (!error) setStudentFees((data as any) || []);
            }
            setPaymentAmounts(prev => ({...prev, [feeId]: ''}));
            setPaymentNotes(prev => ({...prev, [feeId]: ''}));
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
        setPayingFeeId(null);
    };

    const getFeeTitle = (payment: StudentFeePayment) => {
        if ((payment as any).installment?.title) return `Installment: ${(payment as any).installment.title}`;
        return (payment as any).fee_category?.name || 'N/A';
    };
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
    };


    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="classSelectPayment">Select Class</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingClasses || classes.length === 0}>
                        <SelectTrigger id="classSelectPayment"><SelectValue placeholder="Choose a class"/></SelectTrigger>
                        <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="studentSelectPayment">Select Student</Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={isFetchingStudents || students.length === 0}>
                        <SelectTrigger id="studentSelectPayment"><SelectValue placeholder="Choose a student"/></SelectTrigger>
                        <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            
            {selectedStudentId && (
                <Card>
                    <CardHeader><CardTitle>Fee Records for Selected Student</CardTitle></CardHeader>
                    <CardContent>
                        {isFetchingFees ? <Loader2 className="animate-spin" /> : studentFees.length === 0 ? <p className="text-muted-foreground">No fees found for this student.</p> : (
                             <Table>
                                <TableHeader><TableRow><TableHead>Fee Type</TableHead><TableHead>Amount Due</TableHead><TableHead className="w-[150px]">Payment Amount</TableHead><TableHead className="w-[150px]">Payment Mode</TableHead><TableHead className="w-[200px]">Notes</TableHead><TableHead className="w-[120px] text-right">Action</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {studentFees.map(fee => {
                                        const due = fee.assigned_amount - fee.paid_amount;
                                        const currentPayment = paymentAmounts[fee.id] || 0;
                                        const remainingAfterPay = due - Number(currentPayment);
                                        return(
                                        <TableRow key={fee.id}>
                                            <TableCell className="font-medium">{getFeeTitle(fee)}</TableCell>
                                            <TableCell className={`font-mono ${due > 0 ? 'text-destructive' : 'text-green-600'}`}>₹{due.toFixed(2)}</TableCell>
                                            
                                            {due > 0 ? (
                                                <>
                                                    <TableCell>
                                                        <Input type="number" placeholder="Enter amount" value={paymentAmounts[fee.id] || ''} onChange={e => setPaymentAmounts(prev => ({...prev, [fee.id]: e.target.value === '' ? '' : parseFloat(e.target.value)}))} max={due} step="0.01" disabled={payingFeeId === fee.id}/>
                                                        {Number(currentPayment) > 0 && remainingAfterPay >= 0 && <p className="text-xs text-muted-foreground mt-1">Remaining: ₹{remainingAfterPay.toFixed(2)}</p>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={paymentModes[fee.id] || 'Cash'} onValueChange={val => setPaymentModes(prev => ({...prev, [fee.id]: val}))} disabled={payingFeeId === fee.id}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {PAYMENT_METHODS.map(method => (
                                                                    <SelectItem key={method} value={method}>{method}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                     <TableCell>
                                                        <Input placeholder="Optional notes..." value={paymentNotes[fee.id] || ''} onChange={e => setPaymentNotes(prev => ({...prev, [fee.id]: e.target.value}))} disabled={payingFeeId === fee.id}/>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" onClick={() => handlePayClick(fee.id)} disabled={payingFeeId === fee.id || Number(paymentAmounts[fee.id] || 0) <= 0}>
                                                            {payingFeeId === fee.id ? <Loader2 className="animate-spin" /> : 'Record'}
                                                        </Button>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell colSpan={4} className="text-green-600 text-center">Paid in full on {formatDateSafe(fee.payment_date)}</TableCell>
                                            )}
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function StudentFeesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <StudentFeesPageContent />
        </Suspense>
    );
}
