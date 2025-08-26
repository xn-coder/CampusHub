
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Installment, StudentFeePayment, FeeCategory, Student } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Layers, Loader2, MoreHorizontal, ArrowLeft, Filter, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createInstallmentAction, updateInstallmentAction, deleteInstallmentAction, getInstallmentsAction, getAssignedFeesAction, assignFeesToStudentsAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid } from 'date-fns';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getStudentsForSchoolAction } from '../manage-students/actions';
import { getFeeCategoriesAction } from '../fee-categories/actions';


async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', userId).single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function ManageInstallmentsPage() {
  const { toast } = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [assignedFees, setAssignedFees] = useState<(StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, installment: {title: string}})[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allFeeCategories, setAllFeeCategories] = useState<FeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  // Form states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [description, setDescription] = useState('');

  // Filtering state for assigned fees
  const [installmentFilter, setInstallmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // States for Assign Fees tab
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'individual'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedFeeCategoryIds, setSelectedFeeCategoryIds] = useState<string[]>([]);
  const [assignInstallmentId, setAssignInstallmentId] = useState<string>('');
  const [assignDueDate, setAssignDueDate] = useState<string>('');

  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const [installmentsResult, assignedFeesResult, studentsResult, feeCategoriesResult] = await Promise.all([
      getInstallmentsAction(schoolId),
      getAssignedFeesAction(schoolId),
      getStudentsForSchoolAction(schoolId),
      getFeeCategoriesAction(schoolId),
    ]);
      
    if (installmentsResult.ok && installmentsResult.installments) setInstallments(installmentsResult.installments);
    else toast({ title: "Error fetching installments", variant: "destructive" });

    if (assignedFeesResult.ok && assignedFeesResult.fees) setAssignedFees(assignedFeesResult.fees);
    else toast({ title: "Error fetching assigned fees", variant: "destructive" });

    if (studentsResult.ok && studentsResult.students) setAllStudents(studentsResult.students);
    else toast({ title: "Error fetching students", variant: "destructive" });
    
    if (feeCategoriesResult.ok && feeCategoriesResult.categories) setAllFeeCategories(feeCategoriesResult.categories);
    else toast({ title: "Error fetching fee categories", variant: "destructive" });

    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchPageData(schoolId);
        } else {
          toast({ title: "Error", description: "Your account is not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast, fetchPageData]);

  const resetForm = () => {
    setTitle(''); setStartDate(''); setEndDate(''); setLastDate('');
    setDescription(''); setEditingInstallment(null);
  };

  const handleOpenDialog = (installment?: Installment) => {
    if (installment) {
      setEditingInstallment(installment);
      setTitle(installment.title);
      setStartDate(format(parseISO(installment.start_date), 'yyyy-MM-dd'));
      setEndDate(format(parseISO(installment.end_date), 'yyyy-MM-dd'));
      setLastDate(format(parseISO(installment.last_date), 'yyyy-MM-dd'));
      setDescription(installment.description || '');
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate || !lastDate || !currentSchoolId) {
      toast({ title: "Error", description: "Title, all dates, and school context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const installmentData = { title: title.trim(), start_date: startDate, end_date: endDate, last_date: lastDate, description: description.trim() || undefined, school_id: currentSchoolId };
    let result = editingInstallment ? await updateInstallmentAction(editingInstallment.id, installmentData) : await createInstallmentAction(installmentData);
    if (result.ok) {
      toast({ title: editingInstallment ? "Installment Updated" : "Installment Created", description: result.message });
      resetForm();
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteInstallment = async (installmentId: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteInstallmentAction(installmentId, currentSchoolId);
    toast({ title: result.ok ? "Installment Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) fetchPageData(currentSchoolId);
    setIsSubmitting(false);
  };
  
  const handleAssignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const studentIdsToAssign = assignTargetType === 'class' ? allStudents.filter(s => s.class_id === selectedClassId).map(s => s.id) : selectedStudentIds;
    if (studentIdsToAssign.length === 0 || selectedFeeCategoryIds.length === 0 || !assignInstallmentId || !currentSchoolId) {
        toast({ title: "Error", description: "Please select students, fee categories, and an installment plan.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await assignFeesToStudentsAction({
        student_ids: studentIdsToAssign,
        fee_category_ids: selectedFeeCategoryIds,
        installment_id: assignInstallmentId,
        due_date: assignDueDate || undefined,
        school_id: currentSchoolId
    });
    if (result.ok) {
        toast({ title: "Fees Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId); // Refresh data
        // Reset form
        setSelectedClassId('');
        setSelectedStudentIds([]);
        setSelectedFeeCategoryIds([]);
        setAssignInstallmentId('');
        setAssignDueDate('');
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  }
  
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'N/A';
  }

  const filteredAssignedFees = useMemo(() => {
    return assignedFees.filter(fee => {
        const matchesInstallment = installmentFilter === 'all' || fee.installment_id === installmentFilter;
        const matchesStatus = statusFilter === 'all' || fee.status === statusFilter;
        return matchesInstallment && matchesStatus;
    });
  }, [assignedFees, installmentFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Installments"
        description="Create installment plans, assign fees to installments, and view assignment logs."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees</Link>
            </Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Installment
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="plans">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plans">Installment Plans</TabsTrigger>
            <TabsTrigger value="assign">Assign Fees to Installment</TabsTrigger>
            <TabsTrigger value="assigned-log">Assigned Fees Log ({assignedFees.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Layers className="mr-2 h-5 w-5" />Created Installment Plans</CardTitle>
                  <CardDescription>A list of all created fee installments.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  ) : !currentSchoolId ? (
                    <p className="text-destructive text-center py-4">Your account is not associated with a school.</p>
                  ) : installments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No installment plans have been created yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead>
                          <TableHead>Last Date for Payment</TableHead><TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>{installments.map((installment) => (<TableRow key={installment.id}><TableCell className="font-medium">{installment.title}</TableCell><TableCell>{formatDate(installment.start_date)}</TableCell><TableCell>{formatDate(installment.end_date)}</TableCell><TableCell>{formatDate(installment.last_date)}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(installment)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. Deleting this will not unassign it from existing fees, but it will no longer be available for new assignments.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInstallment(installment.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Fees</CardTitle>
                    <CardDescription>Assign multiple fee categories to a class or individual students under an installment plan.</CardDescription>
                </CardHeader>
                 <form onSubmit={handleAssignSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Assign To</Label>
                                <Select value={assignTargetType} onValueChange={(val) => setAssignTargetType(val as any)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="class">Entire Class</SelectItem><SelectItem value="individual">Individual Students</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {assignTargetType === 'class' ? (
                                <div><Label>Select Class</Label><Select value={selectedClassId} onValueChange={setSelectedClassId}><SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger><SelectContent>{allStudents.map(s => s.class_id).filter((v,i,a)=>a.indexOf(v)===i).map(cid => <SelectItem key={cid} value={cid!}>{allStudents.find(s=>s.class_id===cid)?.class_id}</SelectItem>)}</SelectContent></Select></div>
                            ) : (
                                <div><Label>Select Students</Label><p className="text-xs text-muted-foreground">Multi-select student feature coming soon. Please use 'Class' for now.</p></div>
                            )}
                        </div>
                        <div>
                            <Label>Fee Categories to Assign</Label>
                            <div className="p-2 border rounded-md max-h-48 overflow-y-auto space-y-1">
                                {allFeeCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center gap-2"><Checkbox id={`cat-${cat.id}`} checked={selectedFeeCategoryIds.includes(cat.id)} onCheckedChange={checked => setSelectedFeeCategoryIds(prev => checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id))}/><Label htmlFor={`cat-${cat.id}`} className="font-normal">{cat.name} (Default: ₹{cat.amount?.toFixed(2) || 'N/A'})</Label></div>
                                ))}
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><Label>Installment Plan</Label><Select value={assignInstallmentId} onValueChange={setAssignInstallmentId}><SelectTrigger><SelectValue placeholder="Select an installment plan"/></SelectTrigger><SelectContent>{installments.map(i => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Due Date (Optional)</Label><Input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} /></div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Fees
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="assigned-log">
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center">Assigned Fees Log</CardTitle>
                    <CardDescription>A list of all student fees that have been assigned to an installment plan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-wrap gap-4">
                        <div className="flex-grow"><Label htmlFor="installment-filter"><Filter className="inline-block mr-1 h-3 w-3" />Filter by Installment</Label><Select value={installmentFilter} onValueChange={setInstallmentFilter} disabled={isLoading}><SelectTrigger id="installment-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Installments</SelectItem>{installments.map(i => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></div>
                         <div className="flex-grow"><Label htmlFor="status-filter"><Filter className="inline-block mr-1 h-3 w-3" />Filter by Status</Label><Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger id="status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Overdue">Overdue</SelectItem></SelectContent></Select></div>
                    </div>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : filteredAssignedFees.length === 0 ? (<p className="text-muted-foreground text-center py-4">No fees assigned to installments match the current filters.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee</TableHead><TableHead>Installment</TableHead><TableHead>Amount Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filteredAssignedFees.map(fee => (<TableRow key={fee.id}><TableCell className="font-medium">{fee.student.name}</TableCell><TableCell>{fee.fee_category.name}</TableCell><TableCell>{fee.installment?.title || 'N/A'}</TableCell><TableCell>₹{(fee.assigned_amount - fee.paid_amount).toFixed(2)}</TableCell><TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for Creating/Editing Installment Plans */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingInstallment ? 'Edit' : 'Create New'} Installment</DialogTitle></DialogHeader><form onSubmit={handleSubmit}><div className="grid gap-4 py-4"><div><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., First Term, Q1 Fees" required disabled={isSubmitting} /></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="start_date">Start Date</Label><Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isSubmitting} /></div><div><Label htmlFor="end_date">End Date</Label><Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required disabled={isSubmitting} /></div></div><div><Label htmlFor="last_date">Last Date for Payment</Label><Input id="last_date" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} required disabled={isSubmitting} /></div><div><Label htmlFor="description">Description (Optional)</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this installment period" disabled={isSubmitting} /></div></div><DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingInstallment ? 'Save Changes' : 'Create Installment'}</Button></DialogFooter></form></DialogContent>
      </Dialog>
    </div>
  );
}
