

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
import type { StudentFeePayment, Student, FeeCategory, AcademicYear, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { PlusCircle, Trash2, Save, Receipt, DollarSign, Search, Loader2, FileDown, Edit2, FolderOpen } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, isPast, isToday } from 'date-fns';
import {
  assignMultipleFeesToClassAction,
  recordStudentFeePaymentAction,
  deleteStudentFeeAssignmentAction,
  fetchAdminSchoolIdForFees,
  fetchStudentFeesPageDataAction,
  updateStudentFeeAction,
} from './actions';
import { Checkbox } from '@/components/ui/checkbox';

type StudentFeeStatus = 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue';

interface StudentFeeSummary {
  studentId: string;
  studentName: string;
  academicYearId?: string | null;
  academicYearName?: string;
  totalAssigned: number;
  totalPaid: number;
  totalDue: number;
  status: StudentFeeStatus;
  payments: StudentFeePayment[];
}


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
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);


  const [editingFeePayment, setEditingFeePayment] = useState<StudentFeePayment | null>(null);
  const [selectedStudentSummary, setSelectedStudentSummary] = useState<StudentFeeSummary | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcademicYearFilter, setSelectedAcademicYearFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const [selectedClassIdForFee, setSelectedClassIdForFee] = useState<string>('');
  const [selectedFeeCategoryIds, setSelectedFeeCategoryIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | undefined>(undefined);

  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>('');

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
    
    // Set date on client mount to avoid hydration mismatch
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));

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
  const getStudentRollNumber = (studentId: string) => students.find(s => s.id === studentId)?.roll_number || 'N/A';
  const getFeeCategoryName = (feeCategoryId: string) => feeCategories.find(fc => fc.id === feeCategoryId)?.name || 'N/A';
  const getAcademicYearName = (yearId?: string | null) => yearId ? academicYears.find(ay => ay.id === yearId)?.name : 'General';
  

  const resetAssignFeeForm = () => {
    setSelectedClassIdForFee('');
    setSelectedFeeCategoryIds([]);
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

  const handleOpenDetailsDialog = (summary: StudentFeeSummary) => {
    setSelectedStudentSummary(summary);
    setIsDetailsDialogOpen(true);
  };


  const handleAssignFeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId) {
        toast({ title: "Error", description: "School context is required.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    let result;

    if (!selectedClassIdForFee || selectedFeeCategoryIds.length === 0) {
        toast({ title: "Error", description: "Please select a class and at least one fee category.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    result = await assignMultipleFeesToClassAction({
        class_id: selectedClassIdForFee,
        fee_category_ids: selectedFeeCategoryIds,
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
        academic_year_id: selectedAcademicYearId === 'none' ? undefined : selectedAcademicYearId,
        school_id: currentSchoolId,
    });
    

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

  const studentFeeSummaries: StudentFeeSummary[] = useMemo(() => {
    const summaryMap: Record<string, StudentFeeSummary> = {};

    feePayments.forEach(fp => {
        const student = students.find(s => s.id === fp.student_id);
        if (!student) return;

        const academicYearId = fp.academic_year_id || 'general';
        const key = `${student.id}-${academicYearId}`;

        if (!summaryMap[key]) {
            summaryMap[key] = {
                studentId: student.id,
                studentName: student.name,
                academicYearId: fp.academic_year_id,
                academicYearName: getAcademicYearName(fp.academic_year_id),
                totalAssigned: 0,
                totalPaid: 0,
                totalDue: 0,
                status: 'Paid',
                payments: []
            };
        }
        
        const summary = summaryMap[key];
        summary.totalAssigned += fp.assigned_amount;
        summary.totalPaid += fp.paid_amount;
        summary.payments.push(fp);
    });

    return Object.values(summaryMap).map(summary => {
      let hasPending = false;
      let isOverdue = false;
      
      for (const payment of summary.payments) {
          if (payment.status !== 'Paid') {
              hasPending = true;
              if (payment.due_date && isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date))) {
                  isOverdue = true;
                  break;
              }
          }
      }
      
      summary.totalDue = summary.totalAssigned - summary.totalPaid;
      
      if (isOverdue) {
          summary.status = 'Overdue';
      } else if (hasPending && summary.totalPaid > 0) {
          summary.status = 'Partially Paid';
      } else if (hasPending) {
          summary.status = 'Pending';
      } else {
          summary.status = 'Paid';
      }
      
      return summary;
    }).sort((a,b) => a.studentName.localeCompare(b.studentName));
  }, [feePayments, students, academicYears]);


  const filteredSummaries = useMemo(() => {
    return studentFeeSummaries.filter(summary => {
        const studentName = summary.studentName.toLowerCase();
        const search = searchTerm.toLowerCase();

        const matchesSearch = studentName.includes(search);
        const matchesAcademicYear = selectedAcademicYearFilter === 'all' || summary.academicYearId === selectedAcademicYearFilter || (!summary.academicYearId && selectedAcademicYearFilter === 'general');
        
        const matchesStatus = (() => {
            if (selectedStatusFilter === 'all') return true;
            if (selectedStatusFilter === 'Unpaid') {
                return ['Pending', 'Partially Paid', 'Overdue'].includes(summary.status);
            }
            return summary.status === selectedStatusFilter;
        })();

        return matchesSearch && matchesAcademicYear && matchesStatus;
    });
  }, [studentFeeSummaries, searchTerm, selectedAcademicYearFilter, selectedStatusFilter]);

  const handleDownloadCsv = () => {
    if (filteredSummaries.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive"});
        return;
    }

    const headers = ["Student Name", "Roll Number", "Academic Year", "Total Assigned (₹)", "Total Paid (₹)", "Total Due (₹)", "Overall Status"];
    
    const csvRows = [
        headers.join(','),
        ...filteredSummaries.map(summary => {
            const row = [
                `"${summary.studentName.replace(/"/g, '""')}"`,
                `"${getStudentRollNumber(summary.studentId)}"`,
                `"${summary.academicYearName}"`,
                summary.totalAssigned.toFixed(2),
                summary.totalPaid.toFixed(2),
                summary.totalDue.toFixed(2),
                summary.status,
            ];
            return row.join(',');
        })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_fees_summary_${new Date().toISOString().split('T')[0]}.csv`);
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
          <CardDescription>A summarized overview of each student's fee status, grouped by academic year. Click "View & Manage" for details.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="mb-4 flex flex-col md:flex-row gap-4 items-center">
             <Input
                placeholder="Search by student name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                disabled={isLoadingPage}
            />
            <Select value={selectedAcademicYearFilter} onValueChange={setSelectedAcademicYearFilter} disabled={isLoadingPage || academicYears.length === 0}>
                <SelectTrigger className="md:w-[200px]">
                    <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    {academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}
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
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={handleDownloadCsv} disabled={isLoadingPage || filteredSummaries.length === 0} className="md:ml-auto">
                <FileDown className="mr-2 h-4 w-4" />
                Download Summary
            </Button>
           </div>
          {isLoadingPage ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading fee data...</div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage student fees.</p>
          ) : filteredSummaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm || selectedAcademicYearFilter !== 'all' || selectedStatusFilter !== 'all' ? "No students match your filters." : "No student fee records found for this school."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead className="text-right">Total Assigned (<span className="font-mono">₹</span>)</TableHead>
                  <TableHead className="text-right">Total Paid (<span className="font-mono">₹</span>)</TableHead>
                  <TableHead className="text-right">Total Due (<span className="font-mono">₹</span>)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((summary) => (
                  <TableRow key={summary.studentId + (summary.academicYearId || 'general')}>
                    <TableCell className="font-medium">{summary.studentName}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{getStudentRollNumber(summary.studentId)}</span>
                    </TableCell>
                    <TableCell>{summary.academicYearName}</TableCell>
                    <TableCell className="text-right"><span className="font-mono">₹</span>{summary.totalAssigned.toFixed(2)}</TableCell>
                    <TableCell className="text-right"><span className="font-mono">₹</span>{summary.totalPaid.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-semibold ${summary.totalDue > 0 ? 'text-destructive' : ''}`}><span className="font-mono">₹</span>{summary.totalDue.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        summary.status === 'Paid' ? 'default' :
                        summary.status === 'Partially Paid' ? 'secondary' :
                        summary.status === 'Overdue' ? 'destructive' : 'outline'
                      }>
                        {summary.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="outline" size="sm" onClick={() => handleOpenDetailsDialog(summary)} disabled={isSubmitting}>
                           <FolderOpen className="mr-1 h-3 w-3" /> View Details
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* DIALOGS SECTION */}

      <Dialog open={isAssignFeeDialogOpen} onOpenChange={setIsAssignFeeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign New Fee to a Class</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignFeeSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="classIdForFee">Class</Label>
                <Select value={selectedClassIdForFee} onValueChange={setSelectedClassIdForFee} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.length > 0 ? classes.map(c => (<SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)) : <SelectItem value="-" disabled>No classes found</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fee Categories to Assign</Label>
                <Card className="max-h-48 overflow-y-auto p-2 border">
                  <div className="space-y-2">
                    {feeCategories.length > 0 ? feeCategories.map(fc => (
                      <div key={fc.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`fee-cat-${fc.id}`}
                          checked={selectedFeeCategoryIds.includes(fc.id)}
                          onCheckedChange={(checked) => {
                            setSelectedFeeCategoryIds(prev => 
                              checked ? [...prev, fc.id] : prev.filter(id => id !== fc.id)
                            );
                          }}
                          disabled={isSubmitting}
                        />
                        <Label htmlFor={`fee-cat-${fc.id}`} className="font-normal w-full cursor-pointer">
                          {fc.name} {fc.amount ? `(₹${fc.amount.toFixed(2)})` : ''}
                        </Label>
                      </div>
                    )) : <p className="text-xs text-muted-foreground text-center">No fee categories defined.</p>}
                  </div>
                </Card>
                <p className="text-xs text-muted-foreground mt-1">The pre-defined amount for each selected category will be used.</p>
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
                    <SelectItem value="none">None (General)</SelectItem>
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
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" /> } Assign Fees
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
           <DialogHeader>
            <DialogTitle>Fee Details for: {selectedStudentSummary?.studentName}</DialogTitle>
             <CardDescription>
                Academic Year: {selectedStudentSummary?.academicYearName} | Total Due: <span className="font-mono">₹</span>{selectedStudentSummary?.totalDue.toFixed(2)}
            </CardDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fee Category</TableHead>
                        <TableHead>Assigned (<span className="font-mono">₹</span>)</TableHead>
                        <TableHead>Paid (<span className="font-mono">₹</span>)</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedStudentSummary?.payments || []).map((fp) => (
                      <TableRow key={fp.id}>
                        <TableCell className="font-medium">{getFeeCategoryName(fp.fee_category_id)}</TableCell>
                        <TableCell><span className="font-mono">₹</span>{fp.assigned_amount.toFixed(2)}</TableCell>
                        <TableCell><span className="font-mono">₹</span>{fp.paid_amount.toFixed(2)}</TableCell>
                        <TableCell>{fp.due_date ? format(parseISO(fp.due_date), 'PP') : 'N/A'}</TableCell>
                        <TableCell><Badge variant={fp.status === 'Paid' ? 'default' : fp.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fp.status}</Badge></TableCell>
                      </TableRow>
                  ))}
                </TableBody>
            </Table>
          </div>
           <DialogFooter>
              <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
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
                  <Label htmlFor="editAssignedAmount">Assigned Amount (<span className="font-mono">₹</span>)</Label>
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
                Assigned: <span className="font-mono">₹</span>{editingFeePayment?.assigned_amount.toFixed(2)} | Paid: <span className="font-mono">₹</span>{editingFeePayment?.paid_amount.toFixed(2)} | Due: <span className="font-mono">₹</span>{((editingFeePayment?.assigned_amount ?? 0) - (editingFeePayment?.paid_amount ?? 0)) > 0 ? ((editingFeePayment?.assigned_amount ?? 0) - (editingFeePayment?.paid_amount ?? 0)).toFixed(2) : '0.00'}
            </CardDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPaymentSubmit}>
            <div className="grid gap-4 py-4">
               <div>
                <Label htmlFor="paymentAmount">Payment Amount (<span className="font-mono">₹</span>)</Label>
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
