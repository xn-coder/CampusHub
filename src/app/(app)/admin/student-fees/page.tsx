
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, Student, FeeCategory, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Receipt, DollarSign, Search, CalendarClock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';

const MOCK_STUDENT_FEE_PAYMENTS_KEY = 'mockStudentFeePaymentsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_FEE_CATEGORIES_KEY = 'mockFeeCategoriesData';
const MOCK_ACADEMIC_YEARS_KEY = 'mockAcademicYearsData'; // For optional linking

export default function AdminStudentFeesPage() {
  const { toast } = useToast();
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [isAssignFeeDialogOpen, setIsAssignFeeDialogOpen] = useState(false);
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  
  const [editingFeePayment, setEditingFeePayment] = useState<StudentFeePayment | null>(null); // For recording payment
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for Assign Fee Dialog
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState<string>('');
  const [assignedAmount, setAssignedAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  // Form state for Record Payment Dialog
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedFeePayments = localStorage.getItem(MOCK_STUDENT_FEE_PAYMENTS_KEY);
      setFeePayments(storedFeePayments ? JSON.parse(storedFeePayments) : []);

      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setStudents(storedStudents ? JSON.parse(storedStudents) : []);
      
      const storedFeeCategories = localStorage.getItem(MOCK_FEE_CATEGORIES_KEY);
      setFeeCategories(storedFeeCategories ? JSON.parse(storedFeeCategories) : []);
      
      const storedAcademicYears = localStorage.getItem(MOCK_ACADEMIC_YEARS_KEY);
      setAcademicYears(storedAcademicYears ? JSON.parse(storedAcademicYears) : []);
    }
  }, []);

  const updateLocalStorage = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || 'N/A';
  const getFeeCategoryName = (feeCategoryId: string) => feeCategories.find(fc => fc.id === feeCategoryId)?.name || 'N/A';
  const getAcademicYearName = (yearId?: string) => yearId ? academicYears.find(ay => ay.id === yearId)?.name : undefined;

  const resetAssignFeeForm = () => {
    setSelectedStudentId('');
    setSelectedFeeCategoryId('');
    setAssignedAmount('');
    setDueDate('');
    setNotes('');
    setSelectedAcademicYearId(undefined);
    setEditingFeePayment(null); 
  };
  
  const resetRecordPaymentForm = () => {
    setPaymentAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setEditingFeePayment(null);
  };

  const handleOpenAssignFeeDialog = () => {
    resetAssignFeeForm();
    setIsAssignFeeDialogOpen(true);
  };
  
  const handleOpenRecordPaymentDialog = (feePayment: StudentFeePayment) => {
    resetRecordPaymentForm();
    setEditingFeePayment(feePayment);
    setIsRecordPaymentDialogOpen(true);
  };

  const handleAssignFeeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedFeeCategoryId || assignedAmount === '' || Number(assignedAmount) <= 0) {
      toast({ title: "Error", description: "Student, Fee Category, and a valid Assigned Amount are required.", variant: "destructive" });
      return;
    }
    
    const newFeePayment: StudentFeePayment = {
      id: `sfp-${Date.now()}`,
      studentId: selectedStudentId,
      feeCategoryId: selectedFeeCategoryId,
      assignedAmount: Number(assignedAmount),
      paidAmount: 0,
      dueDate: dueDate || undefined,
      status: 'Pending',
      notes: notes.trim() || undefined,
      academicYearId: selectedAcademicYearId === 'none' ? undefined : selectedAcademicYearId,
    };

    const updatedFeePayments = [newFeePayment, ...feePayments];
    setFeePayments(updatedFeePayments);
    updateLocalStorage(MOCK_STUDENT_FEE_PAYMENTS_KEY, updatedFeePayments);
    toast({ title: "Fee Assigned", description: `Fee assigned to ${getStudentName(selectedStudentId)}.` });
    setIsAssignFeeDialogOpen(false);
  };

  const handleRecordPaymentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingFeePayment || paymentAmount === '' || Number(paymentAmount) <= 0) {
      toast({ title: "Error", description: "A valid payment amount is required.", variant: "destructive" });
      return;
    }

    const amountPaidNow = Number(paymentAmount);
    const updatedPaidAmount = editingFeePayment.paidAmount + amountPaidNow;
    let newStatus: StudentFeePayment['status'] = 'Pending';

    if (updatedPaidAmount >= editingFeePayment.assignedAmount) {
      newStatus = 'Paid';
    } else if (updatedPaidAmount > 0) {
      newStatus = 'Partially Paid';
    }
    // Consider 'Overdue' status based on dueDate later if needed

    const updatedFeePayments = feePayments.map(fp => 
      fp.id === editingFeePayment.id ? {
        ...fp,
        paidAmount: updatedPaidAmount,
        status: newStatus,
        paymentDate: paymentDate, // Records the date of this (potentially last) payment
      } : fp
    );
    setFeePayments(updatedFeePayments);
    updateLocalStorage(MOCK_STUDENT_FEE_PAYMENTS_KEY, updatedFeePayments);
    toast({ title: "Payment Recorded", description: `Payment for ${getStudentName(editingFeePayment.studentId)} recorded.` });
    setIsRecordPaymentDialogOpen(false);
  };
  
  const handleDeleteFeeAssignment = (feePaymentId: string) => {
     const feeToDelete = feePayments.find(fp => fp.id === feePaymentId);
     if (!feeToDelete) return;

     if (feeToDelete.paidAmount > 0) {
         toast({ title: "Cannot Delete", description: "This fee assignment has payments recorded and cannot be deleted directly. Consider adjusting or voiding.", variant: "destructive"});
         return;
     }
    if (confirm(`Are you sure you want to delete this fee assignment for ${getStudentName(feeToDelete.studentId)}?`)) {
      const updatedFeePayments = feePayments.filter(fp => fp.id !== feePaymentId);
      setFeePayments(updatedFeePayments);
      updateLocalStorage(MOCK_STUDENT_FEE_PAYMENTS_KEY, updatedFeePayments);
      toast({ title: "Fee Assignment Deleted", variant: "destructive" });
    }
  };
  
  const filteredFeePayments = useMemo(() => {
    return feePayments.filter(fp => {
      const studentName = getStudentName(fp.studentId).toLowerCase();
      const feeCategoryName = getFeeCategoryName(fp.feeCategoryId).toLowerCase();
      const search = searchTerm.toLowerCase();
      return studentName.includes(search) || feeCategoryName.includes(search) || fp.status.toLowerCase().includes(search);
    }).sort((a,b) => (b.dueDate && a.dueDate ? parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime() : 0)); // Sort by due date, newest first
  }, [feePayments, searchTerm, students, feeCategories]);


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student Fee Management"
        description="Assign fees to students, record payments, and track financial records."
        actions={
          <Button onClick={handleOpenAssignFeeDialog}>
            <PlusCircle className="mr-2 h-4 w-4" /> Assign New Fee
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5" />Student Fee Records</CardTitle>
          <CardDescription>Manage all student fee assignments and payments.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="mb-4">
             <Input 
                placeholder="Search by student, fee category, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
            />
           </div>
          {filteredFeePayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm && feePayments.length > 0 ? "No records match your search." : "No student fee records found."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee Category</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead className="text-right">Assigned ($)</TableHead>
                  <TableHead className="text-right">Paid ($)</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeePayments.map((fp) => (
                  <TableRow key={fp.id}>
                    <TableCell className="font-medium">{getStudentName(fp.studentId)}</TableCell>
                    <TableCell>{getFeeCategoryName(fp.feeCategoryId)}</TableCell>
                    <TableCell>{getAcademicYearName(fp.academicYearId) || 'N/A'}</TableCell>
                    <TableCell className="text-right">{fp.assignedAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{fp.paidAmount.toFixed(2)}</TableCell>
                    <TableCell>{fp.dueDate ? format(parseISO(fp.dueDate), 'PP') : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        fp.status === 'Paid' ? 'default' :
                        fp.status === 'Partially Paid' ? 'secondary' :
                        fp.status === 'Overdue' ? 'destructive' : 'outline'
                      }>
                        {fp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {fp.status !== 'Paid' && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenRecordPaymentDialog(fp)}>
                           <DollarSign className="mr-1 h-3 w-3" /> Record Payment
                        </Button>
                      )}
                       <Button variant="destructive" size="icon" onClick={() => handleDeleteFeeAssignment(fp.id)} disabled={fp.paidAmount > 0}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assign New Fee Dialog */}
      <Dialog open={isAssignFeeDialogOpen} onOpenChange={setIsAssignFeeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign New Fee to Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignFeeSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="studentId">Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId} required>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.length > 0 ? students.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>)) : <SelectItem value="-" disabled>No students found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="feeCategoryId">Fee Category</Label>
                <Select value={selectedFeeCategoryId} onValueChange={(val) => {
                    setSelectedFeeCategoryId(val);
                    const cat = feeCategories.find(fc => fc.id === val);
                    if (cat?.amount) setAssignedAmount(cat.amount); else setAssignedAmount('');
                }} required>
                  <SelectTrigger><SelectValue placeholder="Select fee category" /></SelectTrigger>
                  <SelectContent>
                    {feeCategories.length > 0 ? feeCategories.map(fc => (<SelectItem key={fc.id} value={fc.id}>{fc.name} {fc.amount ? `($${fc.amount.toFixed(2)})` : ''}</SelectItem>)) : <SelectItem value="-" disabled>No fee categories defined</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignedAmount">Assigned Amount ($)</Label>
                <Input id="assignedAmount" type="number" value={assignedAmount} onChange={(e) => setAssignedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 100.00" step="0.01" min="0.01" required />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="academicYearId">Academic Year (Optional)</Label>
                <Select value={selectedAcademicYearId} onValueChange={(val) => setSelectedAcademicYearId(val === 'none' ? undefined : val)}>
                  <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {academicYears.map(ay => (<SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any specific notes for this fee" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> Assign Fee</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentDialogOpen} onOpenChange={setIsRecordPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {editingFeePayment ? getStudentName(editingFeePayment.studentId) : ''}</DialogTitle>
            <CardDescription>
                Fee: {editingFeePayment ? getFeeCategoryName(editingFeePayment.feeCategoryId) : ''} <br/>
                Assigned: ${editingFeePayment?.assignedAmount.toFixed(2)} | Paid: ${editingFeePayment?.paidAmount.toFixed(2)} | Due: ${(editingFeePayment?.assignedAmount ?? 0) - (editingFeePayment?.paidAmount ?? 0) > 0 ? ((editingFeePayment?.assignedAmount ?? 0) - (editingFeePayment?.paidAmount ?? 0)).toFixed(2) : '0.00'}
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPaymentSubmit}>
            <div className="grid gap-4 py-4">
               <div>
                <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                <Input id="paymentAmount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Amount being paid" step="0.01" min="0.01" required />
              </div>
              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!editingFeePayment || (editingFeePayment.paidAmount >= editingFeePayment.assignedAmount)}>
                <DollarSign className="mr-2 h-4 w-4" /> Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
