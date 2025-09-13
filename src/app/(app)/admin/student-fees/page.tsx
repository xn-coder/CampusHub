
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
import type { StudentFeePayment, Student, ClassData, PaymentMethod } from '@/types';
import { DollarSign, Loader2, Save, List, Edit2, Trash2 } from 'lucide-react';
import { useState, useEffect, type FormEvent, useCallback, Suspense } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import {
  recordStudentFeePaymentAction,
  getStudentsByClass,
  getFeePaymentPageData,
  getFeesForStudentAction,
  fetchAdminSchoolIdForFees,
} from './actions';
import {
    createPaymentMethodAction,
    updatePaymentMethodAction,
    deletePaymentMethodAction,
    getPaymentMethodsAction
} from './payment-method-actions';
import { useSearchParams } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';


function StudentFeesPageContent() {
  const { toast } = useToast();
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
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
  }, [toast]);

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
        actions={<PaymentMethodsManager schoolId={currentSchoolId} />}
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

function RecordPaymentForm({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentFees, setStudentFees] = useState<StudentFeePayment[]>([]);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    
    // State for the payment dialog
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [feeToPay, setFeeToPay] = useState<StudentFeePayment | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [paymentMode, setPaymentMode] = useState<string>('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    const loadInitialData = useCallback(async () => {
        setIsLoadingInitialData(true);
        const result = await getFeePaymentPageData(schoolId);
        if (result.ok) {
            setClasses(result.classes || []);
            setPaymentMethods(result.methods || []);
            if (result.methods && result.methods.length > 0) {
                setPaymentMode(result.methods[0].name); // Set default payment mode
            }
        } else {
            toast({ title: 'Error', description: result.message || 'Failed to load initial data.', variant: 'destructive' });
        }
        setIsLoadingInitialData(false);
    }, [schoolId, toast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);


    useEffect(() => {
        async function loadStudents() {
            if (!selectedClassId || !schoolId) {
                setStudents([]);
                setSelectedStudentId('');
                setStudentFees([]);
                return;
            }
            setIsFetchingStudents(true);
            const { ok, students: studentsData, message } = await getStudentsByClass(schoolId, selectedClassId);
            if (ok) setStudents(studentsData || []);
            else toast({ title: 'Error', description: message || 'Failed to load students.', variant: 'destructive' });
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
            const { ok, fees: feeData, message } = await getFeesForStudentAction(selectedStudentId);
            if (ok) setStudentFees(feeData || []);
            else toast({ title: 'Error', description: message || 'Failed to load student fees.', variant: 'destructive' });
            setIsFetchingFees(false);
        }
        loadFees();
    }, [selectedStudentId, toast]);

    const handleOpenPaymentDialog = (fee: StudentFeePayment) => {
        setFeeToPay(fee);
        const due = fee.assigned_amount - fee.paid_amount;
        setPaymentAmount(due);
        setPaymentMode(paymentMethods.length > 0 ? paymentMethods[0].name : 'Cash');
        setPaymentNotes('');
        setIsPaymentDialogOpen(true);
    }
    
    const handlePaymentSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!feeToPay || !paymentAmount || paymentAmount <= 0) {
            toast({ title: 'Invalid Amount', description: 'Please enter a valid payment amount.', variant: 'destructive' });
            return;
        }

        setIsSubmittingPayment(true);
        const result = await recordStudentFeePaymentAction({
            fee_payment_id: feeToPay.id,
            payment_amount: paymentAmount,
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            school_id: schoolId!,
            payment_mode: paymentMode,
            notes: paymentNotes
        });

        if (result.ok) {
            toast({ title: 'Payment Recorded', description: 'The payment was successfully recorded.' });
            setIsPaymentDialogOpen(false);
            const { ok, fees: updatedFees } = await getFeesForStudentAction(selectedStudentId);
            if (ok) setStudentFees(updatedFees || []);
        } else {
            toast({ title: 'Error', description: result.message, variant: 'destructive' });
        }
        setIsSubmittingPayment(false);
    };

    const getFeeTitle = (payment: StudentFeePayment) => {
        if (!payment) return 'N/A';
        if ((payment as any).installment?.title) return `Installment: ${(payment as any).installment.title}`;
        return (payment as any).fee_category?.name || 'N/A';
    };
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
    };


    return (
        <>
            <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="classSelectPayment">Select Class</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingInitialData}>
                            <SelectTrigger id="classSelectPayment">
                                <SelectValue placeholder={isLoadingInitialData ? 'Loading classes...' : 'Choose a class'}/>
                            </SelectTrigger>
                            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                        </Select>
                        {classes.length === 0 && !isLoadingInitialData && <p className="text-xs text-muted-foreground mt-1">No classes found.</p>}
                    </div>
                    <div>
                        <Label htmlFor="studentSelectPayment">Select Student</Label>
                        <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={isFetchingStudents || !selectedClassId}>
                            <SelectTrigger id="studentSelectPayment">
                                <SelectValue placeholder={isFetchingStudents ? 'Loading students...' : 'Choose a student'}/>
                            </SelectTrigger>
                            <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {students.length === 0 && !isFetchingStudents && selectedClassId && <p className="text-xs text-muted-foreground mt-1">No students in this class.</p>}
                    </div>
                </div>
                
                {selectedStudentId && (
                    <Card>
                        <CardHeader><CardTitle>Fee Records for Selected Student</CardTitle></CardHeader>
                        <CardContent>
                            {isFetchingFees ? <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div> : studentFees.length === 0 ? <p className="text-muted-foreground text-center py-4">No fees assigned for this student.</p> : (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Fee Type</TableHead><TableHead>Assigned</TableHead><TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {studentFees.map(fee => {
                                            if (!fee) return null; // FIX: Added null check here
                                            const due = fee.assigned_amount - fee.paid_amount;
                                            return(
                                            <TableRow key={fee.id}>
                                                <TableCell className="font-medium">{getFeeTitle(fee)}</TableCell>
                                                <TableCell className="font-mono">₹{fee.assigned_amount.toFixed(2)}</TableCell>
                                                <TableCell className="font-mono">₹{fee.paid_amount.toFixed(2)}</TableCell>
                                                <TableCell className={`font-mono font-semibold ${due > 0 ? 'text-destructive' : 'text-green-600'}`}>₹{due.toFixed(2)}</TableCell>
                                                <TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    {due > 0 ? (
                                                        <Button size="sm" onClick={() => handleOpenPaymentDialog(fee)}>
                                                            Record Payment
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Paid on {formatDateSafe(fee.payment_date)}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handlePaymentSubmit}>
                        <DialogHeader>
                            <DialogTitle>Record Payment for {getFeeTitle(feeToPay as StudentFeePayment)}</DialogTitle>
                            <DialogDescription>
                                Amount due: ₹{(feeToPay ? (feeToPay.assigned_amount - feeToPay.paid_amount) : 0).toFixed(2)}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="paymentAmount" className="text-right">Amount</Label>
                                <Input
                                    id="paymentAmount"
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    max={feeToPay ? (feeToPay.assigned_amount - feeToPay.paid_amount) : 0}
                                    step="0.01"
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="paymentMode" className="text-right">Mode</Label>
                                <Select value={paymentMode} onValueChange={setPaymentMode} required>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paymentMethods.map(method => (
                                            <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
                                        ))}
                                        {paymentMethods.length === 0 && <SelectItem value="Cash">Cash</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="paymentNotes" className="text-right">Notes</Label>
                                <Input id="paymentNotes" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingPayment}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmittingPayment}>
                                {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                Confirm Payment
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function PaymentMethodsManager({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState<PaymentMethod | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const fetchMethods = useCallback(async () => {
        setIsLoading(true);
        const result = await getPaymentMethodsAction(schoolId);
        if (result.ok) setMethods(result.methods || []);
        else toast({ title: "Error", description: "Could not load payment methods." });
        setIsLoading(false);
    }, [schoolId, toast]);

    useEffect(() => {
        if (isDialogOpen) {
            fetchMethods();
        }
    }, [isDialogOpen, fetchMethods]);

    const handleFormSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if(!name.trim()) return;
        setIsLoading(true);
        const action = isEditing
            ? updatePaymentMethodAction(isEditing.id, { name, description }, schoolId)
            : createPaymentMethodAction({ name, description, school_id: schoolId });
        
        const result = await action;
        if(result.ok) {
            toast({ title: "Success", description: result.message });
            fetchMethods();
            setIsEditing(null);
            setName('');
            setDescription('');
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this payment method?")) return;
        setIsLoading(true);
        const result = await deletePaymentMethodAction(id, schoolId);
        if (result.ok) {
            toast({ title: "Deleted", description: result.message, variant: "destructive" });
            fetchMethods();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    };
    
    const startEditing = (method: PaymentMethod) => {
        setIsEditing(method);
        setName(method.name);
        setDescription(method.description || '');
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><List className="mr-2 h-4 w-4" /> Manage Payment Methods</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Manage Payment Methods</DialogTitle>
                    <DialogDescription>Add, edit, or remove accepted payment methods for your school.</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 py-4 max-h-[60vh] overflow-y-auto px-1">
                    <div className="space-y-4">
                        <h3 className="font-semibold">{isEditing ? 'Edit Method' : 'Add New Method'}</h3>
                        <form onSubmit={handleFormSubmit} className="space-y-3">
                            <div>
                                <Label htmlFor="method-name">Name</Label>
                                <Input id="method-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Credit Card" required />
                            </div>
                             <div>
                                <Label htmlFor="method-desc">Description (Optional)</Label>
                                <Textarea id="method-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., All major credit cards" />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={isLoading}>{isEditing ? 'Update' : 'Add'} Method</Button>
                                {isEditing && <Button type="button" variant="ghost" onClick={() => {setIsEditing(null); setName(''); setDescription('');}}>Cancel</Button>}
                            </div>
                        </form>
                    </div>
                    <div className="space-y-2">
                         <h3 className="font-semibold">Existing Methods</h3>
                         <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                            {isLoading ? <Loader2 className="animate-spin" /> : methods.map(method => (
                                <div key={method.id} className="flex justify-between items-center p-2 border rounded-md">
                                    <span className="font-medium">{method.name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(method)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(method.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                            {!isLoading && methods.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No methods created.</p>}
                         </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button>Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function StudentFeesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <StudentFeesPageContent />
        </Suspense>
    );
}
