
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, Student, FeeCategory, AcademicYear, ClassData, Installment, Concession } from '@/types';
import { DollarSign, Loader2, CreditCard, FolderOpen, Save, Edit2, Trash2, ReceiptText, PlusCircle, FileDown, Receipt } from 'lucide-react';
import { useState, useEffect, type FormEvent, useMemo, useCallback, Suspense, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, isPast, isToday, startOfYear, subDays } from 'date-fns';
import {
  recordStudentFeePaymentAction,
  deleteStudentFeeAssignmentAction,
  fetchAdminSchoolIdForFees,
  fetchStudentFeesPageDataAction,
  updateStudentFeeAction,
  applyConcessionAction,
  getConcessionsAction,
  getStudentsByClass,
  getStudentFeeHistory,
} from './actions';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


function StudentFeesPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);

  const [installments, setInstallments] = useState<Installment[]>([]);
  const [concessions, setConcessions] = useState<Concession[]>([]);

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isEditFeeDialogOpen, setIsEditFeeDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isConcessionDialogOpen, setIsConcessionDialogOpen] = useState(false);
  const [isAssignFeeDialogOpen, setIsAssignFeeDialogOpen] = useState(false);

  const [editingFeePayment, setEditingFeePayment] = useState<StudentFeePayment | null>(null);
  const [selectedStudentSummary, setSelectedStudentSummary] = useState<StudentFeeSummary | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAcademicYearFilter, setSelectedAcademicYearFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  const [editAssignedAmount, setEditAssignedAmount] = useState<number | ''>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editInstallmentId, setEditInstallmentId] = useState<string | undefined | null>('');

  const [concessionFeePayment, setConcessionFeePayment] = useState<StudentFeePayment | null>(null);
  const [selectedConcessionId, setSelectedConcessionId] = useState<string>('');
  const [concessionAmount, setConcessionAmount] = useState<number | ''>('');
  
  const refreshAllFeeData = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    setIsLoadingPage(true);
    const pageDataResult = await fetchStudentFeesPageDataAction(schoolId);
    if (pageDataResult.ok) {
      setFeePayments(pageDataResult.feePayments || []);
      setStudents(pageDataResult.students || []);
      setFeeCategories(pageDataResult.feeCategories || []);
      const fetchedYears = pageDataResult.academicYears || [];
      setAcademicYears(fetchedYears);
      setClasses(pageDataResult.classes || []);
      setInstallments(pageDataResult.installments || []);

      const statusParam = searchParams.get('status');
      if (statusParam) setSelectedStatusFilter(statusParam);
      
      const periodParam = searchParams.get('period');
      if (periodParam === 'this_year' && fetchedYears.length > 0) {
        const currentYear = fetchedYears.find(year => {
            const startDate = parseISO(year.start_date);
            const endDate = parseISO(year.end_date);
            const today = new Date();
            return today >= startDate && today <= endDate;
        }) || fetchedYears[0];
        if (currentYear) setSelectedAcademicYearFilter(currentYear.id);
      }
    } else {
      toast({ title: "Error loading fee data", description: pageDataResult.message, variant: "destructive" });
    }
    setIsLoadingPage(false);
  }, [toast, searchParams]);

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

      if (schoolId) {
        await refreshAllFeeData(schoolId);
        const concessionResult = await getConcessionsAction(schoolId);
        if(concessionResult.ok) setConcessions(concessionResult.concessions || []);
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoadingPage(false);
    }
    loadInitialData();
  }, [toast, refreshAllFeeData]);
  

  const getStudentName = useMemo(() => (studentId: string) => students.find(s => s.id === studentId)?.name || 'N/A', [students]);
  const getStudentRollNumber = useMemo(() => (studentId: string) => students.find(s => s.id === studentId)?.roll_number || 'N/A', [students]);
  const getFeeCategoryName = useMemo(() => (feeCategoryId: string) => feeCategories.find(fc => fc.id === feeCategoryId)?.name || 'N/A', [feeCategories]);
  const getAcademicYearName = useMemo(() => (yearId?: string | null) => yearId ? academicYears.find(ay => ay.id === yearId)?.name : 'General', [academicYears]);
  const getStudentClass = useMemo(() => (classId?: string | null) => {
    if (!classId) return 'N/A';
    const cls = classes.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  }, [classes]);
  const getInstallmentTitle = useMemo(() => (installmentId?: string | null) => {
    if (!installmentId) return 'N/A';
    return installments.find(i => i.id === installmentId)?.title || 'N/A';
  }, [installments]);

  const handleOpenEditFeeDialog = (feePayment: StudentFeePayment) => {
    setEditingFeePayment(feePayment); setEditAssignedAmount(feePayment.assigned_amount);
    setEditDueDate(feePayment.due_date ? format(parseISO(feePayment.due_date), 'yyyy-MM-dd') : '');
    setEditNotes(feePayment.notes || ''); setEditInstallmentId(feePayment.installment_id);
    setIsEditFeeDialogOpen(true);
  };
  const handleOpenDetailsDialog = (summary: StudentFeeSummary) => { setSelectedStudentSummary(summary); setIsDetailsDialogOpen(true); };
  const handleOpenConcessionDialog = (feePayment: StudentFeePayment) => {
    setConcessionFeePayment(feePayment); setSelectedConcessionId(''); setConcessionAmount('');
    setIsConcessionDialogOpen(true);
  };
  const handleOpenAssignFeeDialog = () => setIsAssignFeeDialogOpen(true);

  const resetEditFeeForm = () => {
    setEditingFeePayment(null); setEditAssignedAmount(''); setEditDueDate(''); setEditNotes(''); setEditInstallmentId(undefined);
  };
  
  const handleEditFeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFeePayment || !currentSchoolId || editAssignedAmount === '' || Number(editAssignedAmount) <= 0) {
      toast({ title: "Error", description: "A valid fee amount and context are required.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    const result = await updateStudentFeeAction(editingFeePayment.id, currentSchoolId, {
      assigned_amount: Number(editAssignedAmount), due_date: editDueDate || undefined, notes: editNotes.trim() || undefined,
      installment_id: editInstallmentId === 'none' ? null : editInstallmentId 
    });
    if (result.ok) {
        toast({ title: "Fee Updated", description: result.message });
        setIsEditFeeDialogOpen(false); resetEditFeeForm();
        if (currentSchoolId) refreshAllFeeData(currentSchoolId);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
   const handleApplyConcession = async (e: FormEvent) => {
    e.preventDefault();
    if (!concessionFeePayment || !selectedConcessionId || concessionAmount === '' || !currentSchoolId || !currentUserId) {
        toast({ title: "Error", description: "All fields are required to apply a concession.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await applyConcessionAction({
      student_id: concessionFeePayment.student_id,
      fee_payment_id: concessionFeePayment.id,
      concession_id: selectedConcessionId,
      amount: Number(concessionAmount),
      school_id: currentSchoolId,
      applied_by_user_id: currentUserId,
    });

    if (result.ok) {
      toast({ title: "Concession Applied", description: result.message });
      setIsConcessionDialogOpen(false);
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
      if (result.ok && currentSchoolId) refreshAllFeeData(currentSchoolId);
      setIsSubmitting(false);
    }
  };
  
  interface StudentFeeSummary {
    studentId: string;
    studentName: string;
    studentClassId?: string | null;
    academicYearId?: string | null;
    academicYearName?: string;
    totalAssigned: number;
    totalPaid: number;
    totalDue: number;
    status: 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue';
    payments: StudentFeePayment[];
    summaryId: string;
  }

  const studentFeeSummaries: StudentFeeSummary[] = useMemo(() => {
    const summaryMap: Record<string, StudentFeeSummary> = {};
    feePayments.forEach(fp => {
        const student = students.find(s => s.id === fp.student_id);
        if (!student) return;
        const academicYearGroupKey = fp.academic_year_id || 'general';
        const key = `${student.id}-${academicYearGroupKey}`;
        if (!summaryMap[key]) {
            summaryMap[key] = {
                studentId: student.id, studentName: student.name, studentClassId: student.class_id, academicYearId: fp.academic_year_id,
                academicYearName: getAcademicYearName(fp.academic_year_id), totalAssigned: 0, totalPaid: 0, totalDue: 0,
                status: 'Paid', payments: [], summaryId: key,
            };
        }
        const summary = summaryMap[key];
        summary.totalAssigned += fp.assigned_amount; summary.totalPaid += fp.paid_amount; summary.payments.push(fp);
    });
    return Object.values(summaryMap).map(summary => {
      let hasPending = false; let isOverdue = false;
      for (const payment of summary.payments) {
          if (payment.status !== 'Paid') {
              hasPending = true;
              if (payment.due_date && isPast(parseISO(payment.due_date)) && !isToday(parseISO(payment.due_date))) { isOverdue = true; break; }
          }
      }
      summary.totalDue = summary.totalAssigned - summary.totalPaid;
      if (isOverdue) { summary.status = 'Overdue';
      } else if (hasPending && summary.totalPaid > 0) { summary.status = 'Partially Paid';
      } else if (hasPending) { summary.status = 'Pending';
      } else { summary.status = 'Paid'; }
      return summary;
    }).sort((a,b) => a.studentName.localeCompare(b.studentName));
  }, [feePayments, students, academicYears, getAcademicYearName]);

  const filteredSummaries = useMemo(() => {
    return studentFeeSummaries.filter(summary => {
        const matchesSearch = summary.studentName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAcademicYear = selectedAcademicYearFilter === 'all' || (selectedAcademicYearFilter === 'general' && !summary.academicYearId) || summary.academicYearId === selectedAcademicYearFilter;
        const matchesClass = selectedClassFilter === 'all' || summary.studentClassId === selectedClassFilter;
        const matchesStatus = (() => {
            if (selectedStatusFilter === 'all') return true;
            if (selectedStatusFilter === 'Unpaid') return ['Pending', 'Partially Paid', 'Overdue'].includes(summary.status);
            return summary.status === selectedStatusFilter;
        })();
        return matchesSearch && matchesAcademicYear && matchesStatus && matchesClass;
    });
  }, [studentFeeSummaries, searchTerm, selectedAcademicYearFilter, selectedStatusFilter, selectedClassFilter]);

  const handleDownloadCsv = () => {
    if (filteredSummaries.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive"}); return;
    }
    const headers = ["Student Name", "Roll Number", "Academic Year", "Total Assigned (₹)", "Total Paid (₹)", "Total Due (₹)", "Overall Status"];
    const csvRows = [headers.join(','), ...filteredSummaries.map(summary => {
            const row = [`"${summary.studentName.replace(/"/g, '""')}"`, `"${getStudentRollNumber(summary.studentId)}"`, `"${summary.academicYearName}"`,
                summary.totalAssigned.toFixed(2), summary.totalPaid.toFixed(2), summary.totalDue.toFixed(2), summary.status];
            return row.join(',');
        })];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `student_fees_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  
    if (isLoadingPage && !currentSchoolId) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Student Fee Records" />
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> <span>Loading fee records...</span>
                </div>
            </div>
        );
    }
    
    return (
      <div className="flex flex-col gap-6 min-h-screen">
        <PageHeader
          title="Student Fee Records" description="Assign fees to students, record payments, and track financial records."
          actions={<Button onClick={handleOpenAssignFeeDialog} disabled={!currentSchoolId || isSubmitting || isLoadingPage}><Receipt className="mr-2 h-4 w-4" /> Assign New Fee</Button>}
        />
  
        {!currentSchoolId ? (
          <Card>
            <CardHeader>
              <CardTitle>School Association Required</CardTitle>
              <CardDescription>Your admin account is not associated with a school. Please contact support.</CardDescription>
            </CardHeader>
             <CardContent>
                 <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage student fees.</p>
             </CardContent>
          </Card>
        ) : (
         <Tabs defaultValue="summary" className="flex flex-col gap-6">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summary" disabled={isLoadingPage}>Fee Summary</TabsTrigger>
              <TabsTrigger value="payment">Record Payment</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><ReceiptText className="mr-2 h-5 w-5" />Fee Summary</CardTitle>
                <CardDescription>A summarized overview of each student's fee status, grouped by academic year. Click "View &amp; Manage" for details.</CardDescription>
             </CardHeader>
              <CardContent>
                 <div className="mb-4 flex flex-col md:flex-row gap-4">
                   <Input placeholder="Search by student name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" disabled={isLoadingPage}/>
                  <Select value={selectedAcademicYearFilter} onValueChange={setSelectedAcademicYearFilter} disabled={isLoadingPage || academicYears.length === 0}>
                      <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Years</SelectItem><SelectItem value="general">General</SelectItem>{academicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent>
                  </Select>
                   <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={isLoadingPage || classes.length === 0}>
                      <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="All Classes" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter} disabled={isLoadingPage}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Overdue">Overdue</SelectItem></SelectContent>
                  </Select>
                  <Button onClick={handleDownloadCsv} disabled={isLoadingPage || filteredSummaries.length === 0} className="md:ml-auto"><FileDown className="mr-2 h-4 w-4" />Download Summary</Button>
                 </div>
                {isLoadingPage ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading fee data...</div>) : !currentSchoolId ? (<p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage student fees.</p>) : filteredSummaries.length === 0 ? (<p className="text-muted-foreground text-center py-4">{searchTerm || selectedAcademicYearFilter !== 'all' || selectedStatusFilter !== 'all' ? "No students match your filters." : "No student fee records found for this school."}</p>) : (
                  <Table className="min-w-full divide-y divide-gray-200">
                    <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Academic Year</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>{filteredSummaries.map((summary) => (<TableRow key={summary.summaryId}><TableCell className="font-medium">{summary.studentName} <span className="font-mono text-xs text-muted-foreground">({getStudentRollNumber(summary.studentId)})</span></TableCell><TableCell>{getStudentClass(summary.studentClassId)}</TableCell><TableCell>{summary.academicYearName}</TableCell><TableCell className={`text-right font-semibold ${summary.totalDue > 0 ? 'text-destructive' : ''}`}><span className="font-mono">₹</span>{summary.totalDue.toFixed(2)}</TableCell><TableCell><Badge variant={summary.status === 'Paid' ? 'default' : summary.status === 'Partially Paid' ? 'secondary' : summary.status === 'Overdue' ? 'destructive' : 'outline'}>{summary.status}</Badge></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleOpenDetailsDialog(summary)} disabled={isSubmitting}><FolderOpen className="mr-1 h-3 w-3" /> View &amp; Manage</Button></TableCell></TableRow>))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="payment">
              <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />Record Manual Payment</CardTitle>
                    <CardDescription>Select a student to view their fees and record a payment.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <RecordPaymentForm schoolId={currentSchoolId} />
                  </CardContent>
              </Card>
          </TabsContent>
        </Tabs>
        )} 
        
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}><DialogContent className="sm:max-w-3xl">
             <DialogHeader><DialogTitle>Fee Details for: {selectedStudentSummary?.studentName}</DialogTitle><DialogDescription>Academic Year: {selectedStudentSummary?.academicYearName} | Total Due: <span className="font-mono">₹</span>{selectedStudentSummary?.totalDue.toFixed(2)}</DialogDescription></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Fee Category</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{(selectedStudentSummary?.payments || []).map((fp) => (<TableRow key={fp.id}><TableCell className="font-medium">{getFeeCategoryName(fp.fee_category_id)}</TableCell><TableCell>{fp.due_date ? format(parseISO(fp.due_date), 'PP') : 'N/A'}</TableCell><TableCell><Badge variant={fp.status === 'Paid' ? 'default' : fp.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fp.status}</Badge></TableCell><TableCell className="text-right space-x-1">{fp.status !== 'Paid' && (<Button variant="outline" size="sm" onClick={() => handleOpenConcessionDialog(fp)}>Apply Concession</Button>)}<Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditFeeDialog(fp)} disabled={isSubmitting}><Edit2 className="h-4 w-4"/></Button><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeleteFeeAssignment(fp.id)} disabled={isSubmitting || fp.paid_amount > 0}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></div>
             <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent></Dialog>
  
        <Dialog open={isEditFeeDialogOpen} onOpenChange={setIsEditFeeDialogOpen}><DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Fee for {getStudentName(editingFeePayment?.student_id || '')}</DialogTitle><CardDescription>Category: {getFeeCategoryName(editingFeePayment?.fee_category_id || '')}</CardDescription></DialogHeader>
            <form onSubmit={handleEditFeeSubmit}>
               <div className="grid gap-4 py-4">
                  <div><Label htmlFor="editAssignedAmount">Assigned Amount (<span className="font-mono">₹</span>)</Label><Input id="editAssignedAmount" type="number" value={editAssignedAmount} onChange={(e) => setEditAssignedAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required disabled={isSubmitting}/></div>
                  <div><Label htmlFor="editDueDate">Due Date</Label><Input id="editDueDate" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={isSubmitting}/></div>
                  <div><Label htmlFor="editInstallmentId">Installment</Label><Select value={editInstallmentId || 'none'} onValueChange={val => setEditInstallmentId(val === 'none' ? undefined : val)} disabled={isSubmitting}><SelectTrigger><SelectValue placeholder="Select an installment"/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{installments.map(i => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label htmlFor="editNotes">Notes</Label><Input id="editNotes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} disabled={isSubmitting}/></div>
              </div>
              <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes</Button></DialogFooter>
            </form>
        </DialogContent></Dialog>
        
         <Dialog open={isConcessionDialogOpen} onOpenChange={setIsConcessionDialogOpen}><DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Apply Concession</DialogTitle><DialogDescription>Apply a concession to the fee '{getFeeCategoryName(concessionFeePayment?.fee_category_id || '')}' for {getStudentName(concessionFeePayment?.student_id || '')}.</DialogDescription></DialogHeader>
              <form onSubmit={handleApplyConcession}>
                  <div className="grid gap-4 py-4">
                      <div><Label htmlFor="concessionType">Concession Type</Label><Select value={selectedConcessionId} onValueChange={setSelectedConcessionId} required><SelectTrigger><SelectValue placeholder="Select concession type"/></SelectTrigger><SelectContent>{concessions.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label htmlFor="concessionAmount">Concession Amount (₹)</Label><Input id="concessionAmount" type="number" value={concessionAmount} onChange={e => setConcessionAmount(Number(e.target.value))} required min="0.01" max={(concessionFeePayment?.assigned_amount || 0) - (concessionFeePayment?.paid_amount || 0)}/></div>
                  </div>
                  <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Apply Concession</Button></DialogFooter>
              </form>
         </DialogContent></Dialog>
      </div>
    );
}

function RecordPaymentForm({ schoolId }: { schoolId: string | null }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [studentFees, setStudentFees] = useState<StudentFeePayment[]>([]);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    
    const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number | ''>>({});
    const [paymentModes, setPaymentModes] = useState<Record<string, string>>({});
    const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
    const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

    useEffect(() => {
        async function loadClasses() {
            if (!schoolId) return;
            setIsLoading(true);
            const { data: classesData, error } = await supabase.from('classes').select('*').eq('school_id', schoolId);
            if (error) toast({ title: 'Error', description: 'Failed to load classes.', variant: 'destructive' });
            else setClasses(classesData || []);
            setIsLoading(false);
        }
        loadClasses();
    }, [schoolId, toast]);

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
            setIsLoading(true);
            const { data, error } = await supabase
                .from('student_fee_payments')
                .select('*, fee_category:fee_category_id(name), installment:installment_id(title)')
                .eq('student_id', selectedStudentId)
                .order('due_date', { ascending: false });

            if (error) toast({ title: 'Error', description: 'Failed to load student fees.', variant: 'destructive' });
            else setStudentFees((data as any) || []);
            setIsLoading(false);
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

    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="classSelectPayment">Select Class</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || classes.length === 0}>
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
                        {isLoading ? <Loader2 className="animate-spin" /> : studentFees.length === 0 ? <p className="text-muted-foreground">No fees found for this student.</p> : (
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
                                                            <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Cheque">Cheque</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem></SelectContent>
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
