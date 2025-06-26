
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, Student, FeeCategory, AcademicYear, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Trash2, Save, Receipt, DollarSign, Search, Loader2, FileDown, Edit2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import {
  assignStudentFeeAction,
  assignFeeToClassAction,
  recordStudentFeePaymentAction,
  deleteStudentFeeAssignmentAction,
  fetchAdminSchoolIdForFees,
  fetchStudentFeesPageDataAction,
  updateStudentFeeAction,
} from './actions';

export default function AdminStudentFeesPage() {
  const { toast } = useToast();
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isAssignFeeDialogOpen, setIsAssignFeeDialogOpen] = useState(false);
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [isEditFeeDialogOpen, setIsEditFeeDialogOpen] = useState(false);


  const [editingFeePayment, setEditingFeePayment] = useState<StudentFeePayment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const [assignmentType, setAssignmentType] = useState<'individual' | 'class'>('individual');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedClassIdForFee, setSelectedClassIdForFee] = useState<string>('');
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState<string>('');
  const [assignedAmount, setAssignedAmount] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Edit form state
  const [editAssignedAmount, setEditAssignedAmount] = useState<number | ''>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');


  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (!adminUserId) {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoadingPage(false);
      return;
    }

    async function loadInitialData() {
      setIsLoadingPage(true);
      const schoolId = await fetchAdminSchoolIdForFees(adminUserId);
      setCurrentSchoolId(schoolId);

      if (schoolId) {
        await refreshAllFeeData(schoolId);
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoadingPage(false);
    }
    loadInitialData();
  }, [toast]);

  async function refreshAllFeeData(schoolId: string) {
    if (!schoolId) return;
    setIsLoadingPage(true); // Indicate loading for refresh
    const pageDataResult = await fetchStudentFeesPageDataAction(schoolId);
    if (pageDataResult.ok) {
      setFeePayments(pageDataResult.feePayments || []);
      setStudents(pageDataResult.students || []);
      setFeeCategories(pageDataResult.feeCategories || []);
      setAcademicYears(pageDataResult.academicYears || []);
      setClasses(pageDataResult.classes || []);
    } else {
      toast({ title: "Error loading fee data", description: pageDataResult.message, variant: "destructive" });
    }
    setIsLoadingPage(false);
  }

  const getStudentName = (studentId: string) => students.find(s => s.id === studentId)?.name || 'N/A';
  const getFeeCategoryName = (feeCategoryId: string) => feeCategories.find(fc => fc.id === feeCategoryId)?.name || 'N/A';
  const getAcademicYearName = (yearId?: string | null) => yearId ? academicYears.find(ay => ay.id === yearId)?.name : undefined;
  const getClassDisplayName = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };

  const resetAssignFeeForm = () => {
    setAssignmentType('individual');
    setSelectedStudentId(''); 
    setSelectedClassIdForFee('');
    setSelectedFeeCategoryId(''); 
    setAssignedAmount('');
    setDueDate(''); 
    setNotes(''); 
    setSelectedAcademicYearId(undefined);
    setEditingFeePayment(null);
  };
  
  const resetEditFeeForm = () => {
    setEditingFeePayment(null);
    setEditAssignedAmount('');
    setEditDueDate('');
    setEditNotes('');
  }

  const resetRecordPaymentForm = () => {
    setPaymentAmount(''); setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setEditingFeePayment(null);
  };

  const handleOpenAssignFeeDialog = () => { resetAssignFeeForm(); setIsAssignFeeDialogOpen(true); };

  const handleOpenRecordPaymentDialog = (feePayment: StudentFeePayment) => {
    resetRecordPaymentForm(); setEditingFeePayment(feePayment); setIsRecordPaymentDialogOpen(true);
  };

  const handleOpenEditFeeDialog = (feePayment: StudentFeePayment) => {
    setEditingFeePayment(feePayment);
    setEditAssignedAmount(feePayment.assigned_amount);
    setEditDueDate(feePayment.due_date ? format(parseISO(feePayment.due_date), 'yyyy-MM-dd') : '');
    setEditNotes(feePayment.notes || '');
    setIsEditFeeDialogOpen(true);
  };


  const handleAssignFeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId || !selectedFeeCategoryId || assignedAmount === '' || Number(assignedAmount) <= 0) {
        toast({ title: "Error", description: "Fee Category, valid Assigned Amount, and School context are required.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    let result;

    if (assignmentType === 'individual') {
        if (!selectedStudentId) {
            toast({ title: "Error", description: "Please select a student.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        result = await assignStudentFeeAction({
            student_id: selectedStudentId,
            fee_category_id: selectedFeeCategoryId,
            assigned_amount: Number(assignedAmount),
            due_date: dueDate || undefined,
            notes: notes.trim() || undefined,
            academic_year_id: selectedAcademicYearId === 'none' ? undefined : selectedAcademicYearId,
            school_id: currentSchoolId,
        });
    } else { // assignmentType === 'class'
        if (!selectedClassIdForFee) {
            toast({ title: "Error", description: "Please select a class.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        result = await assignFeeToClassAction({
            class_id: selectedClassIdForFee,
            fee_category_id: selectedFeeCategoryId,
            assigned_amount: Number(assignedAmount),
            due_date: dueDate || undefined,
            notes: notes.trim() || undefined,
            academic_year_id: selectedAcademicYearId === 'none' ? undefined : selectedAcademicYearId,
            school_id: currentSchoolId,
        });
    }

    if (result.ok) {
        toast({ title: "Fee Assigned", description: result.message });
        setIsAssignFeeDialogOpen(false);
        if (currentSchoolId) refreshAllFeeData(currentSchoolId);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleEditFeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFeePayment || !currentSchoolId || editAssignedAmount === '' || Number(editAssignedAmount) <= 0) {
      toast({ title: "Error", description: "A valid fee amount and context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const result = await updateStudentFeeAction(editingFeePayment.id, currentSchoolId, {
      assigned_amount: Number(editAssignedAmount),
      due_date: editDueDate || undefined,
      notes: editNotes.trim() || undefined,
    });
    
    if (result.ok) {
        toast({ title: "Fee Updated", description: result.message });
        setIsEditFeeDialogOpen(false);
        resetEditFeeForm();
        if (currentSchoolId) refreshAllFeeData(currentSchoolId);
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
      if (currentSchoolId) refreshAllFeeData(currentSchoolId);
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
      if (result.ok && currentSchoolId) {
        refreshAllFeeData(currentSchoolId);
      }
      setIsSubmitting(false);
    }
  };

  const filteredFeePayments = useMemo(() => {
    return feePayments.filter(fp => {
      const student = students.find(s => s.id === fp.student_id);
      if (!student) return false;

      const studentName = student.name.toLowerCase();
      const feeCategoryName = getFeeCategoryName(fp.fee_category_id).toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch = studentName.includes(search) || feeCategoryName.includes(search);
      const matchesClass = selectedClassFilter === 'all' || student.class_id === selectedClassFilter;
      const matchesStatus = selectedStatusFilter === 'all' || 
                            (selectedStatusFilter === 'Paid' && fp.status === 'Paid') ||
                            (selectedStatusFilter === 'Unpaid' && (fp.status === 'Pending' || fp.status === 'Partially Paid' || fp.status === 'Overdue'));

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [feePayments, searchTerm, students, feeCategories, selectedClassFilter, selectedStatusFilter]);

  const handleDownloadCsv = () => {
    if (filteredFeePayments.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive"});
        return;
    }

    const headers = ["Student Name", "Class", "Fee Category", "Assigned Amount", "Paid Amount", "Due Date", "Status", "Notes"];
    
    const csvRows = [
        headers.join(','),
        ...filteredFeePayments.map(fp => {
            const student = students.find(s => s.id === fp.student_id);
            const className = student && student.class_id ? getClassDisplayName(student.class_id) : 'N/A';
            
            const row = [
                `"${student?.name || 'N/A'}"`,
                `"${className}"`,
                `"${getFeeCategoryName(fp.fee_category_id)}"`,
                fp.assigned_amount,
                fp.paid_amount,
                fp.due_date ? format(parseISO(fp.due_date), 'yyyy-MM-dd') : 'N/A',
                fp.status,
                `"${fp.notes?.replace(/"/g, '""') || ''}"` // Escape double quotes
            ];
            return row.join(',');
        })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_fees_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student Fee Management"
        description="Assign fees to students, record payments, and track financial records."
        actions={
          <Button onClick={handleOpenAssignFeeDialog} disabled={!currentSchoolId || isSubmitting || isLoadingPage}>
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
           <div className="mb-4 flex flex-col md:flex-row gap-4 items-center">
             <Input
                placeholder="Search by student or fee category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                disabled={isLoadingPage}
            />
            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={isLoadingPage || classes.length === 0}>
                <SelectTrigger className="md:w-[200px]">
                    <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter} disabled={isLoadingPage}>
                <SelectTrigger className="md:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={handleDownloadCsv} disabled={isLoadingPage || filteredFeePayments.length === 0} className="md:ml-auto">
                <FileDown className="mr-2 h-4 w-4" />
                Download Report
            </Button>
           </div>
          {isLoadingPage ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading fee data...</div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage student fees.</p>
          ) : filteredFeePayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm || selectedClassFilter !== 'all' || selectedStatusFilter !== 'all' ? "No records match your filters." : "No student fee records found for this school."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee Category</TableHead>
                  <TableHead className="text-right">Assigned ($)</TableHead>
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
                    <TableCell className="text-right">{fp.assigned_amount.toFixed(2)}</TableCell>
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
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditFeeDialog(fp)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>Assign New Fee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignFeeSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label>Assignment Type</Label>
                <RadioGroup value={assignmentType} onValueChange={(val) => setAssignmentType(val as 'individual' | 'class')} className="flex space-x-4 pt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="r-individual" />
                    <Label htmlFor="r-individual">Individual Student</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="class" id="r-class" />
                    <Label htmlFor="r-class">Entire Class</Label>
                  </div>
                </RadioGroup>
              </div>

              {assignmentType === 'individual' ? (
                <div>
                  <Label htmlFor="studentId">Student</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId} required disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>
                      {students.length > 0 ? students.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>)) : <SelectItem value="-" disabled>No students found</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="classIdForFee">Class</Label>
                  <Select value={selectedClassIdForFee} onValueChange={setSelectedClassIdForFee} required disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.length > 0 ? classes.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)) : <SelectItem value="-" disabled>No classes found</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
      
      <Dialog open={isEditFeeDialogOpen} onOpenChange={setIsEditFeeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Fee for {getStudentName(editingFeePayment?.student_id || '')}</DialogTitle>
            <CardDescription>Category: {getFeeCategoryName(editingFeePayment?.fee_category_id || '')}</CardDescription>
          </DialogHeader>
          <form onSubmit={handleEditFeeSubmit}>
            <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="editAssignedAmount">Assigned Amount ($)</Label>
                  <Input id="editAssignedAmount" type="number" value={editAssignedAmount} onChange={(e) => setEditAssignedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required disabled={isSubmitting}/>
                </div>
                <div>
                  <Label htmlFor="editDueDate">Due Date</Label>
                  <Input id="editDueDate" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={isSubmitting}/>
                </div>
                <div>
                  <Label htmlFor="editNotes">Notes</Label>
                  <Input id="editNotes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} disabled={isSubmitting}/>
                </div>
            </div>
            <DialogFooter>
               <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
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
