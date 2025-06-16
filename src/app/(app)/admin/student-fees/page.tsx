
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
import { PlusCircle, Edit2, Trash2, Save, Receipt, DollarSign, Search, CalendarClock, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { assignStudentFeeAction, recordStudentFeePaymentAction, deleteStudentFeeAssignmentAction } from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export default function AdminStudentFeesPage() {
  const { toast } = useToast();
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isAssignFeeDialogOpen, setIsAssignFeeDialogOpen] = useState(false);
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  
  const [editingFeePayment, setEditingFeePayment] = useState<StudentFeePayment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState<string>('');
  const [assignedAmount, setAssignedAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchAllFeeData(schoolId);
        } else {
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast]);

  async function fetchAllFeeData(schoolId: string) {
    setIsLoading(true);
    const results = await Promise.all([
      supabase.from('student_fee_payments').select('*').eq('school_id', schoolId).order('due_date', { ascending: false, nullsFirst: false }),
      supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('fee_categories').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('academic_years').select('*').eq('school_id', schoolId).order('start_date', { ascending: false })
    ]);
    
    const [feePaymentsRes, studentsRes, feeCategoriesRes, academicYearsRes] = results;

    if (feePaymentsRes.error) toast({ title: "Error fetching fee payments", description: feePaymentsRes.error.message, variant: "destructive" });
    else setFeePayments(feePaymentsRes.data || []);

    if (studentsRes.error) toast({ title: "Error fetching students", description: studentsRes.error.message, variant: "destructive" });
    else setStudents(studentsRes.data || []);

    if (feeCategoriesRes.error) toast({ title: "Error fetching fee categories", description: feeCategoriesRes.error.message, variant: "destructive" });
    else setFeeCategories(feeCategoriesRes.data || []);

    if (academicYearsRes.error) toast({ title: "Error fetching academic years", description: academicYearsRes.error.message, variant: "destructive" });
    else setAcademicYears(academicYearsRes.data || []);
    
    setIsLoading(false);
  }

  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || 'N/A';
  const getFeeCategoryName = (feeCategoryId: string) => feeCategories.find(fc => fc.id === feeCategoryId)?.name || 'N/A';
  const getAcademicYearName = (yearId?: string | null) => yearId ? academicYears.find(ay => ay.id === yearId)?.name : undefined;

  const resetAssignFeeForm = () => {
    setSelectedStudentId(''); setSelectedFeeCategoryId(''); setAssignedAmount('');
    setDueDate(''); setNotes(''); setSelectedAcademicYearId(undefined);
    setEditingFeePayment(null); 
  };
  
  const resetRecordPaymentForm = () => {
    setPaymentAmount(''); setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setEditingFeePayment(null);
  };

  const handleOpenAssignFeeDialog = () => { resetAssignFeeForm(); setIsAssignFeeDialogOpen(true); };
  
  const handleOpenRecordPaymentDialog = (feePayment: StudentFeePayment) => {
    resetRecordPaymentForm(); setEditingFeePayment(feePayment); setIsRecordPaymentDialogOpen(true);
  };

  const handleAssignFeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedFeeCategoryId || assignedAmount === '' || Number(assignedAmount) <= 0 || !currentSchoolId) {
      toast({ title: "Error", description: "Student, Fee Category, valid Assigned Amount, and School context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await assignStudentFeeAction({
      student_id: selectedStudentId,
      fee_category_id: selectedFeeCategoryId,
      assigned_amount: Number(assignedAmount),
      due_date: dueDate || undefined,
      notes: notes.trim() || undefined,
      academic_year_id: selectedAcademicYearId === 'none' ? undefined : selectedAcademicYearId,
      school_id: currentSchoolId,
    });
    if (result.ok) {
      toast({ title: "Fee Assigned", description: result.message });
      setIsAssignFeeDialogOpen(false);
      fetchAllFeeData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleRecordPaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFeePayment || paymentAmount === '' || Number(paymentAmount) <= 0 || !currentSchoolId) {
      toast({ title: "Error", description: "Valid payment amount and fee record context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await recordStudentFeePaymentAction({
      fee_payment_id: editingFeePayment.id,
      payment_amount: Number(paymentAmount),
      payment_date: paymentDate,
      school_id: currentSchoolId,
    });
    if (result.ok) {
      toast({ title: "Payment Recorded", description: result.message });
      setIsRecordPaymentDialogOpen(false);
      fetchAllFeeData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteFeeAssignment = async (feePaymentId: string) => {
     if (!currentSchoolId) return;
     const feeToDelete = feePayments.find(fp => fp.id === feePaymentId);
     if (!feeToDelete) return;

     if (confirm(`Are you sure you want to delete this fee assignment for ${getStudentName(feeToDelete.student_id)}? This action cannot be undone if there are no payments recorded.`)) {
      setIsSubmitting(true);
      const result = await deleteStudentFeeAssignmentAction(feePaymentId, currentSchoolId);
      toast({ title: result.ok ? "Fee Assignment Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok) {
        fetchAllFeeData(currentSchoolId);
      }
      setIsSubmitting(false);
    }
  };
  
  const filteredFeePayments = useMemo(() => {
    return feePayments.filter(fp => {
      const studentName = getStudentName(fp.student_id).toLowerCase();
      const feeCategoryName = getFeeCategoryName(fp.fee_category_id).toLowerCase();
      const search = searchTerm.toLowerCase();
      return studentName.includes(search) || feeCategoryName.includes(search) || fp.status.toLowerCase().includes(search);
    }); // Sorting is now done by Supabase query
  }, [feePayments, searchTerm, students, feeCategories]);


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student Fee Management"
        description="Assign fees to students, record payments, and track financial records."
        actions={
          <Button onClick={handleOpenAssignFeeDialog} disabled={!currentSchoolId || isSubmitting}>
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
                disabled={isLoading}
            />
           </div>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage student fees.</p>
          ) : filteredFeePayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm && feePayments.length > 0 ? "No records match your search." : "No student fee records found for this school."}
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
                    <TableCell className="font-medium">{getStudentName(fp.student_id)}</TableCell>
                    <TableCell>{getFeeCategoryName(fp.fee_category_id)}</TableCell>
                    <TableCell>{getAcademicYearName(fp.academic_year_id) || 'N/A'}</TableCell>
                    <TableCell className="text-right">{fp.assigned_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{fp.paid_amount.toFixed(2)}</TableCell>
                    <TableCell>{fp.due_date ? format(parseISO(fp.due_date), 'PP') : 'N/A'}</TableCell>
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
                        <Button variant="outline" size="sm" onClick={() => handleOpenRecordPaymentDialog(fp)} disabled={isSubmitting}>
                           <DollarSign className="mr-1 h-3 w-3" /> Record Payment
                        </Button>
                      )}
                       <Button variant="destructive" size="icon" onClick={() => handleDeleteFeeAssignment(fp.id)} disabled={isSubmitting || fp.paid_amount > 0}>
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

      <Dialog open={isAssignFeeDialogOpen} onOpenChange={setIsAssignFeeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign New Fee to Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignFeeSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="studentId">Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId} required disabled={isSubmitting}>
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
                }} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select fee category" /></SelectTrigger>
                  <SelectContent>
                    {feeCategories.length > 0 ? feeCategories.map(fc => (<SelectItem key={fc.id} value={fc.id}>{fc.name} {fc.amount ? `($${fc.amount.toFixed(2)})` : ''}</SelectItem>)) : <SelectItem value="-" disabled>No fee categories defined</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assignedAmount">Assigned Amount ($)</Label>
                <Input id="assignedAmount" type="number" value={assignedAmount} onChange={(e) => setAssignedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 100.00" step="0.01" min="0.01" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting}/>
              </div>
              <div>
                <Label htmlFor="academicYearId">Academic Year (Optional)</Label>
                <Select value={selectedAcademicYearId} onValueChange={(val) => setSelectedAcademicYearId(val === 'none' ? undefined : val)} disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {academicYears.map(ay => (<SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any specific notes for this fee" disabled={isSubmitting}/>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" /> } Assign Fee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isRecordPaymentDialogOpen} onOpenChange={setIsRecordPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {editingFeePayment ? getStudentName(editingFeePayment.student_id) : ''}</DialogTitle>
            <CardDescription>
                Fee: {editingFeePayment ? getFeeCategoryName(editingFeePayment.fee_category_id) : ''} <br/>
                Assigned: ${editingFeePayment?.assigned_amount.toFixed(2)} | Paid: ${editingFeePayment?.paid_amount.toFixed(2)} | Due: ${(editingFeePayment?.assigned_amount ?? 0) - (editingFeePayment?.paid_amount ?? 0) > 0 ? ((editingFeePayment?.assigned_amount ?? 0) - (editingFeePayment?.paid_amount ?? 0)).toFixed(2) : '0.00'}
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPaymentSubmit}>
            <div className="grid gap-4 py-4">
               <div>
                <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
                <Input id="paymentAmount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Amount being paid" step="0.01" min="0.01" required disabled={isSubmitting}/>
              </div>
              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required disabled={isSubmitting}/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || !editingFeePayment || (editingFeePayment.paid_amount >= editingFeePayment.assigned_amount)}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DollarSign className="mr-2 h-4 w-4" /> } Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    