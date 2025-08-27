
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
    getManageInstallmentsPageData
} from './actions';
import { getFeeStructureForClassAction } from '../manage-fee-structures/actions';
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
  const [allFeeCategories, setAllFeeCategories] = useState<FeeCategory[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allAcademicYears, setAllAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

  // Form states for creating/editing installments
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  
  // States for Assign Fees tab
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'individual'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [assignInstallmentId, setAssignInstallmentId] = useState<string>('');
  const [selectedFeeCategoryIds, setSelectedFeeCategoryIds] = useState<Record<string, { selected: boolean; amount: string }>>({});
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignAcademicYearId, setAssignAcademicYearId] = useState<string>('');
  const [classFeeStructure, setClassFeeStructure] = useState<Record<string, number>>({});


  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getManageInstallmentsPageData(schoolId);
      
    if (result.ok) {
      setInstallments(result.installments || []);
      setAssignedFees(result.assignedFees || []);
      setAllStudents(result.students || []);
      const feeCategories = result.feeCategories || [];
      setAllFeeCategories(feeCategories);
      const initialFeeSelectionState = feeCategories.reduce((acc, cat) => {
        acc[cat.id] = { selected: false, amount: cat.amount?.toString() || '' };
        return acc;
      }, {} as Record<string, { selected: boolean; amount: string }>);
      setSelectedFeeCategoryIds(initialFeeSelectionState);
      setAllClasses(result.classes || []);

      const { data: years } = await supabase.from('academic_years').select('*').eq('school_id', schoolId);
      setAllAcademicYears(years || []);

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

  // Fetch fee structure when class and academic year change
  useEffect(() => {
    async function fetchStructure() {
        if (!selectedClassId || !assignAcademicYearId) {
            setClassFeeStructure({});
            return;
        }
        const result = await getFeeStructureForClassAction(selectedClassId, assignAcademicYearId);
        if (result.ok && result.structure) {
            setClassFeeStructure(result.structure.structure);
        } else {
            setClassFeeStructure({});
        }
    }
    fetchStructure();
  }, [selectedClassId, assignAcademicYearId]);

  // Update amounts when fee structure is loaded or fee categories change
  useEffect(() => {
    setSelectedFeeCategoryIds(prev => {
        const newSelection = { ...prev };
        allFeeCategories.forEach(cat => {
            const structureAmount = classFeeStructure[cat.id];
            const defaultAmount = cat.amount;
            newSelection[cat.id] = {
                ...newSelection[cat.id],
                amount: (structureAmount ?? defaultAmount ?? '').toString()
            };
        });
        return newSelection;
    });
  }, [classFeeStructure, allFeeCategories]);


  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
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
    setAssignAcademicYearId('');
    const resetFees = Object.keys(selectedFeeCategoryIds).reduce((acc, key) => {
        acc[key] = { ...selectedFeeCategoryIds[key], selected: false };
        return acc;
    }, {} as typeof selectedFeeCategoryIds);
    setSelectedFeeCategoryIds(resetFees);
  };

  const handleOpenDialog = (installment?: Installment) => {
    if (installment) {
      setEditingInstallment(installment);
      setTitle(installment.title);
      setDescription(installment.description || '');
      setStartDate(format(parseISO(installment.start_date), 'yyyy-MM-dd'));
      setEndDate(format(parseISO(installment.end_date), 'yyyy-MM-dd'));
      setLastDate(format(parseISO(installment.last_date), 'yyyy-MM-dd'));
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentSchoolId || !startDate || !endDate || !lastDate) {
      toast({ title: "Error", description: "Title and all dates are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const installmentData = { 
      title: title.trim(),
      description: description.trim() || undefined,
      school_id: currentSchoolId,
      start_date: startDate,
      end_date: endDate,
      last_date: lastDate,
    };

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
    let studentIdsToAssign: string[] = [];
    if (assignTargetType === 'class' && selectedClassId) {
        studentIdsToAssign = allStudents.filter(s => s.class_id === selectedClassId).map(s => s.id);
    } else if (assignTargetType === 'individual' && selectedStudentId) {
        studentIdsToAssign = [selectedStudentId];
    }
    
    const feesToAssign = Object.entries(selectedFeeCategoryIds)
        .filter(([, val]) => val.selected && val.amount && Number(val.amount) > 0)
        .map(([categoryId, val]) => ({
            category_id: categoryId,
            amount: Number(val.amount)
        }));

    if (studentIdsToAssign.length === 0 || feesToAssign.length === 0 || !assignInstallmentId || !currentSchoolId) {
        toast({ title: "Error", description: "Please select students, fee categories with amounts, and an installment plan.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    const result = await assignFeesToInstallmentAction({
        student_ids: studentIdsToAssign,
        fees_to_assign: feesToAssign,
        installment_id: assignInstallmentId,
        due_date: assignDueDate || undefined,
        school_id: currentSchoolId,
        academic_year_id: assignAcademicYearId || undefined,
        notes: assignNotes,
    });
    if (result.ok) {
        toast({ title: "Fees Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId);
        resetAssignmentForm();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleFeeSelectionChange = (categoryId: string, isSelected: boolean) => {
    setSelectedFeeCategoryIds(prev => ({
        ...prev,
        [categoryId]: {
            ...prev[categoryId],
            selected: isSelected,
        }
    }));
  };

  const handleAmountChange = (categoryId: string, amount: string) => {
    setSelectedFeeCategoryIds(prev => ({
        ...prev,
        [categoryId]: {
            ...(prev[categoryId] || { selected: true }),
            amount: amount
        }
    }));
  };

  const formatDate = (dateString: string) => {
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'MMM d, yyyy') : 'N/A';
    } catch(e) {
        return 'Invalid Date';
    }
  };

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudents]);

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
      <Tabs defaultValue="assign">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assign">Assign Fees to Installment</TabsTrigger>
            <TabsTrigger value="plans">Installment Plans</TabsTrigger>
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
                  : <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Last Payment Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{installments.map((item) => (<TableRow key={item.id}><TableCell className="font-medium">{item.title}</TableCell><TableCell>{formatDate(item.start_date)}</TableCell><TableCell>{formatDate(item.end_date)}</TableCell><TableCell>{formatDate(item.last_date)}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(item)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the installment plan "{item.title}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInstallment(item.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table>
                  }
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Fees</CardTitle>
                    <CardDescription>Assign multiple fee categories to a class or an individual student under an installment plan.</CardDescription>
                </CardHeader>
                 <form onSubmit={handleAssignSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                            <div><Label>Academic Year</Label><Select value={assignAcademicYearId} onValueChange={setAssignAcademicYearId}><SelectTrigger><SelectValue placeholder="Choose a year"/></SelectTrigger><SelectContent>{allAcademicYears.map(ay => <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>)}</SelectContent></Select></div>
                            <div><Label>Assign To</Label><Select value={assignTargetType} onValueChange={(val) => setAssignTargetType(val as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="class">Entire Class</SelectItem><SelectItem value="individual">Individual Student</SelectItem></SelectContent></Select></div>
                             <div><Label>Select Class</Label><Select value={selectedClassId} onValueChange={setSelectedClassId}><SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger><SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        {assignTargetType === 'individual' && (
                            <div><Label>Select Student</Label><Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedClassId}><SelectTrigger><SelectValue placeholder="Choose a student from the selected class"/></SelectTrigger><SelectContent>{studentsInSelectedClass.length > 0 ? (studentsInSelectedClass.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)) : (<SelectItem value="none" disabled>No students in this class</SelectItem>)}</SelectContent></Select></div>
                        )}
                        <div>
                            <Label>Fee Categories to Assign</Label>
                            <Card className="max-h-60 overflow-y-auto p-2 border">
                              <div className="space-y-3">
                                {allFeeCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center space-x-3">
                                        <Checkbox 
                                            id={`cat-${cat.id}`} 
                                            checked={selectedFeeCategoryIds[cat.id]?.selected || false}
                                            onCheckedChange={checked => handleFeeSelectionChange(cat.id, !!checked)}
                                        />
                                        <Label htmlFor={`cat-${cat.id}`} className="font-normal flex-1 cursor-pointer">{cat.name}</Label>
                                        <Input type="number" placeholder="Amount" className="w-32" value={selectedFeeCategoryIds[cat.id]?.amount || ''} onChange={(e) => handleAmountChange(cat.id, e.target.value)} disabled={!selectedFeeCategoryIds[cat.id]?.selected} required={selectedFeeCategoryIds[cat.id]?.selected} step="0.01" min="0.01"/>
                                    </div>
                                ))}
                              </div>
                            </Card>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                           <div><Label>Installment Plan</Label><Select value={assignInstallmentId} onValueChange={setAssignInstallmentId} required><SelectTrigger><SelectValue placeholder="Select an installment plan"/></SelectTrigger><SelectContent>{installments.map(i => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Due Date (Optional)</Label><Input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} /></div>
                        </div>
                         <div><Label>Notes (Optional)</Label><Input value={assignNotes} onChange={e => setAssignNotes(e.target.value)} placeholder="e.g., Annual fee installment 1"/></div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Fees
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="log">
            <Card>
                 <CardHeader><CardTitle className="flex items-center">Assigned Installment Fees Log</CardTitle></CardHeader>
                <CardContent>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : assignedFees.length === 0 ? (<p className="text-muted-foreground text-center py-4">No fees have been assigned to an installment plan yet.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Type</TableHead><TableHead>Installment</TableHead><TableHead>Amount Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{assignedFees.map(fee => (<TableRow key={fee.id}><TableCell>{(fee.student as any)?.name}</TableCell><TableCell>{(fee.fee_category as any)?.name}</TableCell><TableCell>{(fee.installment as any)?.title}</TableCell><TableCell>₹{(fee.assigned_amount - fee.paid_amount).toFixed(2)}</TableCell><TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingInstallment ? 'Edit' : 'Create New'} Installment</DialogTitle></DialogHeader><form onSubmit={handleSubmit}><div className="grid gap-4 py-4"><div className="space-y-1"><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., First Term, Q1 Fees" required disabled={isSubmitting} /></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="start_date">Start Date</Label><Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isSubmitting} /></div><div><Label htmlFor="end_date">End Date</Label><Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required disabled={isSubmitting} /></div></div><div><Label htmlFor="last_date">Last Date for Payment</Label><Input id="last_date" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} required disabled={isSubmitting} /></div><div className="space-y-1"><Label htmlFor="description">Description (Optional)</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this installment period" disabled={isSubmitting}/></div></div><DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingInstallment ? 'Save Changes' : 'Create Installment'}</Button></DialogFooter></form></DialogContent>
      </Dialog>
    </div>
  );
}
