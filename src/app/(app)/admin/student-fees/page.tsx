
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
import type { StudentFeePayment, Student, ClassData } from '@/types';
import { DollarSign, Loader2, Save, List, Edit2, Trash2 } from 'lucide-react';
import { useState, useEffect, type FormEvent, useCallback, Suspense } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import {
  recordStudentFeePaymentAction,
  fetchAdminSchoolIdForFees,
  getStudentsByClass,
} from './actions';
import {
    getPaymentMethodsAction,
    createPaymentMethodAction,
    updatePaymentMethodAction,
    deletePaymentMethodAction,
    type PaymentMethod
} from './payment-method-actions';
import { supabase } from '@/lib/supabaseClient';
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
            {currentSchoolId ? (
                <RecordPaymentForm schoolId={currentSchoolId} />
            ) : (
                <p className="text-muted-foreground">Waiting for school context...</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecordPaymentForm({ schoolId }: { schoolId: string }) {
    const { toast } = useToast();
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [isFetchingFees, setIsFetchingFees] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentFees, setStudentFees] = useState<StudentFeePayment[]>([]);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number | ''>>({});
    const [paymentModes, setPaymentModes] = useState<Record<string, string>>({});
    const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
    const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

    const loadPageData = useCallback(async () => {
        setIsLoadingClasses(true);
        const [classesRes, methodsRes] = await Promise.all([
            supabase.from('classes').select('*').eq('school_id', schoolId),
            getPaymentMethodsAction(schoolId)
        ]);

        if (classesRes.error) {
            toast({ title: 'Error', description: 'Failed to load classes.', variant: 'destructive' });
            setClasses([]);
        } else {
            setClasses(classesRes.data || []);
        }

        if (methodsRes.ok) {
            setPaymentMethods(methodsRes.methods || []);
        } else {
            toast({ title: 'Error', description: 'Failed to load payment methods.', variant: 'destructive' });
        }
        setIsLoadingClasses(false);
    }, [schoolId, toast]);

    useEffect(() => {
        loadPageData();
    }, [loadPageData]);


    useEffect(() => {
        async function loadStudents() {
            if (!selectedClassId) {
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
        const mode = paymentModes[feeId] || (paymentMethods.length > 0 ? paymentMethods[0].name : 'Cash');
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
                    <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingClasses}>
                        <SelectTrigger id="classSelectPayment">
                            <SelectValue placeholder={isLoadingClasses ? 'Loading classes...' : 'Choose a class'}/>
                        </SelectTrigger>
                        <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                    </Select>
                     {classes.length === 0 && !isLoadingClasses && <p className="text-xs text-muted-foreground mt-1">No classes found.</p>}
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
                                                        <Select value={paymentModes[fee.id] || (paymentMethods.length > 0 ? paymentMethods[0].name : 'Cash')} onValueChange={val => setPaymentModes(prev => ({...prev, [fee.id]: val}))} disabled={payingFeeId === fee.id}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {paymentMethods.map(method => (
                                                                    <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
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

    