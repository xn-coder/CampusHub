
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Installment, Student, StudentFeePayment, ClassData, FeeCategory, AcademicYear } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Layers, Loader2, MoreHorizontal, ArrowLeft, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { 
    createInstallmentAction, 
    updateInstallmentAction, 
    deleteInstallmentAction, 
    assignFeesToInstallmentAction,
    getManageInstallmentsPageData,
    updateStudentFeeAction,
    deleteStudentFeeAssignmentAction
} from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';


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
  const [assignedFees, setAssignedFees] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

  // Form states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lastDate, setLastDate] = useState('');
  
  // Edit Assignment Dialog
  const [isEditAssignmentOpen, setIsEditAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<StudentFeePayment | null>(null);
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editDueDate, setEditDueDate] = useState('');

  // States for Assign Group tab
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'individual'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [assignInstallmentId, setAssignInstallmentId] = useState<string>('');
  const [assignAmount, setAssignAmount] = useState<number | ''>('');
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudents]);


  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getManageInstallmentsPageData(schoolId);
      
    if (result.ok) {
        setInstallments(result.installments || []);
        setAssignedFees(result.assignedFees || []);
        setAllStudents(result.students || []);
        setAllClasses(result.classes || []);
    } else {
        toast({ title: "Error fetching page data", description: result.message, variant: "destructive" });
    }

    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(userId);
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

  // Auto-fill due date when installment plan is selected
  useEffect(() => {
    if (assignInstallmentId) {
      const selectedInstallment = installments.find(i => i.id === assignInstallmentId);
      if (selectedInstallment) {
        setAssignDueDate(selectedInstallment.last_date);
      } else {
        setAssignDueDate('');
      }
    } else {
      setAssignDueDate('');
    }
  }, [assignInstallmentId, installments]);


  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLastDate('');
    setEditingInstallment(null);
  };
  
   const resetAssignmentForm = () => {
    setAssignTargetType('class');
    setSelectedClassId('');
    setSelectedStudentId('');
    setAssignInstallmentId('');
    setAssignDueDate('');
    setAssignNotes('');
    setAssignAmount('');
  };

  const handleOpenDialog = (installment?: Installment) => {
    if (installment) {
      setEditingInstallment(installment);
      setTitle(installment.title);
      setDescription(installment.description || '');
      setLastDate(installment.last_date ? format(parseISO(installment.last_date), 'yyyy-MM-dd') : '');
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !lastDate || !currentSchoolId) {
      toast({ title: "Error", description: "Title, Last Date, and school context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const installmentData = { 
      title: title.trim(),
      description: description.trim() || undefined,
      last_date: lastDate,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: lastDate,
      school_id: currentSchoolId 
    };

    let result = editingInstallment ? await updateInstallmentAction(editingInstallment.id, installmentData) : await createInstallmentAction(installmentData as any);
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
    let studentIdsToAssign: string[] = [];
    if (assignTargetType === 'class' && selectedClassId) {
        studentIdsToAssign = allStudents.filter(s => s.class_id === selectedClassId).map(s => s.id);
    } else if (assignTargetType === 'individual' && selectedStudentId) {
        studentIdsToAssign = [selectedStudentId];
    }

    if (studentIdsToAssign.length === 0 || !assignInstallmentId || assignAmount === '' || !currentSchoolId || !currentAdminUserId) {
        toast({ title: "Error", description: "Please complete all required fields in the assignment form.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await assignFeesToInstallmentAction({
        student_ids: studentIdsToAssign,
        installment_id: assignInstallmentId,
        amount: Number(assignAmount),
        due_date: assignDueDate || undefined,
        school_id: currentSchoolId,
        notes: assignNotes
    });
    if (result.ok) {
        toast({ title: "Fees Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId);
        resetAssignmentForm();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  const handleOpenEditAssignmentDialog = (fee: StudentFeePayment) => {
    setEditingAssignment(fee);
    setEditAmount(fee.assigned_amount);
    setEditDueDate(fee.due_date ? format(parseISO(fee.due_date), 'yyyy-MM-dd') : '');
    setIsEditAssignmentOpen(true);
  };
  
  const handleEditAssignmentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || editAmount === '' || !currentSchoolId) {
        toast({title: "Error", description: "All fields are required.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await updateStudentFeeAction(editingAssignment.id, currentSchoolId, {
        assigned_amount: Number(editAmount),
        due_date: editDueDate || undefined,
    });
    if (result.ok) {
        toast({title: "Success", description: result.message});
        setIsEditAssignmentOpen(false);
        if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
  }
  
  const handleDeleteFeeAssignment = async (feePaymentId: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteStudentFeeAssignmentAction(feePaymentId, currentSchoolId);
    if (result.ok) {
      toast({ title: "Assignment Deleted", description: result.message, variant: "destructive" });
      if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const formatDate = (dateString?: string | null) => {
    if(!dateString) return 'N/A';
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'MMM d, yyyy') : 'Invalid Date';
    } catch(e) {
        return 'Invalid Date';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Installments"
        description="Define installment plans and assign fees to students."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild><Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees</Link></Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> Add Installment</Button>
          </div>
        }
      />
      <Tabs defaultValue="plans">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plans">Installment Plans</TabsTrigger>
            <TabsTrigger value="assign">Assign Fees to Installment</TabsTrigger>
            <TabsTrigger value="log">Assignment Log ({assignedFees.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Layers className="mr-2 h-5 w-5" />Defined Installment Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  : installments.length === 0 ? <p className="text-muted-foreground text-center py-4">No installment plans have been created yet.</p>
                  : <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Description</TableHead><TableHead>Last Payment Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{installments.map((item) => (<TableRow key={item.id}><TableCell className="font-medium">{item.title}</TableCell><TableCell>{item.description}</TableCell><TableCell>{formatDate(item.last_date)}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(item)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the installment plan "{item.title}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInstallment(item.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table>
                  }
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Fee Installment</CardTitle>
                    <CardDescription>Assign an installment fee to an entire class or an individual student.</CardDescription>
                </CardHeader>
                 <form onSubmit={handleAssignSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Assign To</Label>
                                <Select value={assignTargetType} onValueChange={(val) => { setAssignTargetType(val as any); setSelectedClassId(''); setSelectedStudentId(''); }}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="class">Entire Class</SelectItem><SelectItem value="individual">Individual Student</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Select Class</Label>
                                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                    <SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger>
                                    <SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        {assignTargetType === 'individual' && (
                            <div><Label>Select Student</Label><Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedClassId || studentsInSelectedClass.length === 0}><SelectTrigger><SelectValue placeholder="Choose a student from the selected class"/></SelectTrigger><SelectContent>{studentsInSelectedClass.length > 0 ? (studentsInSelectedClass.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)) : (<SelectItem value="none" disabled>No students in this class</SelectItem>)}</SelectContent></Select></div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                           <div><Label>Installment Plan</Label><Select value={assignInstallmentId} onValueChange={setAssignInstallmentId} required><SelectTrigger><SelectValue placeholder="Select an installment plan"/></SelectTrigger><SelectContent>{installments.map(i => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Amount (₹)</Label><Input type="number" placeholder="Enter amount..." value={assignAmount} onChange={e => setAssignAmount(e.target.value === '' ? '' : Number(e.target.value))} required step="0.01" min="0.01"/></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><Label>Due Date (Optional)</Label><Input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} /></div>
                            <div><Label>Notes (Optional)</Label><Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="e.g., Annual fee installment 1"/></div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Installment
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="log">
            <Card>
                 <CardHeader><CardTitle className="flex items-center">Assigned Installments Log</CardTitle></CardHeader>
                <CardContent>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : assignedFees.length === 0 ? (<p className="text-muted-foreground text-center py-4">No fees have been assigned to an installment plan yet.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Type</TableHead><TableHead>Installment</TableHead><TableHead>Amount Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{assignedFees.map(fee => (<TableRow key={fee.id}><TableCell>{fee.student?.name || 'N/A'}</TableCell><TableCell>{fee.fee_category?.name || 'N/A'}</TableCell><TableCell>{fee.installment?.title || 'N/A'}</TableCell><TableCell>₹{(fee.assigned_amount - fee.paid_amount).toFixed(2)}</TableCell><TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditAssignmentDialog(fee)}><Edit2 className="h-4 w-4"/></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone and will permanently delete the fee assignment for {fee.student.name}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteFeeAssignment(fee.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                        </TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingInstallment ? 'Edit' : 'Create New'} Installment Plan</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="space-y-1"><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., First Term, Q1 Fees" required disabled={isSubmitting} /></div>
              <div className="space-y-1"><Label htmlFor="last_date">Last Date for Payment</Label><Input id="last_date" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} required disabled={isSubmitting} /></div>
              <div className="space-y-1"><Label htmlFor="description">Description (Optional)</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this installment period" disabled={isSubmitting}/></div>
            </div>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingInstallment ? 'Save Changes' : 'Create Installment'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditAssignmentOpen} onOpenChange={setIsEditAssignmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assigned Fee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditAssignmentSubmit}>
            <div className="space-y-4 py-4">
              <div><Label htmlFor="editAmount">Assigned Amount (₹)</Label><Input id="editAmount" type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} required disabled={isSubmitting}/></div>
              <div><Label htmlFor="editDueDate">Due Date</Label><Input id="editDueDate" type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} disabled={isSubmitting}/></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
