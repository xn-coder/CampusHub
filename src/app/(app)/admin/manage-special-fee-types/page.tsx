"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { FeeType, StudentFeePayment, FeeCategory, Student, FeeTypeInstallmentType } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, IndianRupee, Loader2, MoreHorizontal, ArrowLeft, Filter, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createSpecialFeeTypeAction, updateSpecialFeeTypeAction, deleteSpecialFeeTypeAction, getSpecialFeeTypesAction, getAssignedSpecialFeesAction, assignSpecialFeeTypeToStudentsAction } from './actions';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', userId).single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function ManageSpecialFeeTypesPage() {
  const { toast } = useToast();
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [assignedFees, setAssignedFees] = useState<(StudentFeePayment & { student: {name: string, email: string}, fee_category: {name: string}, fee_type: {name: string}})[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allFeeCategories, setAllFeeCategories] = useState<FeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  // Form states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [installmentType, setInstallmentType] = useState<FeeTypeInstallmentType>('extra_charge');
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState('');
  const [isRefundable, setIsRefundable] = useState(false);
  const [description, setDescription] = useState('');

  // Filtering state for assigned fees
  const [feeTypeFilter, setFeeTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // States for Assign Fees tab
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'individual'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignFeeTypeId, setAssignFeeTypeId] = useState<string>('');
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [assignAmount, setAssignAmount] = useState<number | ''>('');


  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const [feeTypesResult, assignedFeesResult, studentsResult, feeCategoriesResult] = await Promise.all([
      getSpecialFeeTypesAction(schoolId),
      getAssignedSpecialFeesAction(schoolId),
      getStudentsForSchoolAction(schoolId),
      getFeeCategoriesAction(schoolId),
    ]);
      
    if (feeTypesResult.ok && feeTypesResult.feeTypes) setFeeTypes(feeTypesResult.feeTypes);
    else toast({ title: "Error fetching special fee types", variant: "destructive" });

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
    setName(''); setDisplayName(''); setInstallmentType('extra_charge');
    setSelectedFeeCategoryId(''); setIsRefundable(false); setDescription('');
    setEditingFeeType(null);
  };

  const handleOpenDialog = (feeType?: FeeType) => {
    if (feeType) {
      setEditingFeeType(feeType);
      setName(feeType.name);
      setDisplayName(feeType.display_name);
      setInstallmentType(feeType.installment_type);
      setSelectedFeeCategoryId(feeType.fee_category_id);
      setIsRefundable(feeType.is_refundable);
      setDescription(feeType.description || '');
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !displayName.trim() || !selectedFeeCategoryId || !currentSchoolId) {
      toast({ title: "Error", description: "Fee Type Name, Display Name, and Fee Category are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const feeTypeData = { 
      name: name.trim(),
      display_name: displayName.trim(),
      installment_type: installmentType,
      fee_category_id: selectedFeeCategoryId,
      is_refundable: isRefundable,
      description: description.trim() || undefined, 
      school_id: currentSchoolId 
    };

    let result = editingFeeType ? await updateSpecialFeeTypeAction(editingFeeType.id, feeTypeData) : await createSpecialFeeTypeAction(feeTypeData);
    if (result.ok) {
      toast({ title: editingFeeType ? "Special Fee Type Updated" : "Special Fee Type Created", description: result.message });
      resetForm();
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteFeeType = async (feeTypeId: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteSpecialFeeTypeAction(feeTypeId, currentSchoolId);
    toast({ title: result.ok ? "Special Fee Type Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) fetchPageData(currentSchoolId);
    setIsSubmitting(false);
  };
  
  const handleAssignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const studentIdsToAssign = assignTargetType === 'class' ? allStudents.filter(s => s.class_id === selectedClassId).map(s => s.id) : selectedStudentIds;
    if (studentIdsToAssign.length === 0 || !assignFeeTypeId || !currentSchoolId || assignAmount === '') {
        toast({ title: "Error", description: "Please select students, a fee type, and enter an amount.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await assignSpecialFeeTypeToStudentsAction({
        student_ids: studentIdsToAssign,
        fee_type_id: assignFeeTypeId,
        amount: Number(assignAmount),
        due_date: assignDueDate || undefined,
        school_id: currentSchoolId
    });
    if (result.ok) {
        toast({ title: "Fees Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId); 
        setSelectedClassId('');
        setSelectedStudentIds([]);
        setAssignFeeTypeId('');
        setAssignDueDate('');
        setAssignAmount('');
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
        const matchesFeeType = feeTypeFilter === 'all' || fee.fee_type_id === feeTypeFilter;
        const matchesStatus = statusFilter === 'all' || fee.status === statusFilter;
        return matchesFeeType && matchesStatus;
    });
  }, [assignedFees, feeTypeFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Special Fee Types"
        description="Handle one-off or unique fees that are not part of regular installments."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees</Link>
            </Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Special Fee Type
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="plans">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plans">Fee Type Definitions</TabsTrigger>
            <TabsTrigger value="assign">Assign Fee Type</TabsTrigger>
            <TabsTrigger value="assigned-log">Assigned Fees Log ({assignedFees.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><IndianRupee className="mr-2 h-5 w-5" />Created Special Fee Types</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  : feeTypes.length === 0 ? <p className="text-muted-foreground text-center py-4">No special fee types have been created yet.</p>
                  : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Display Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{feeTypes.map((ft) => (<TableRow key={ft.id}><TableCell className="font-medium">{ft.name}</TableCell><TableCell>{ft.display_name}</TableCell><TableCell>{(ft as any).fee_category?.name || 'N/A'}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(ft)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will permanently delete the special fee type "{ft.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteFeeType(ft.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table>
                  }
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Special Fee</CardTitle>
                    <CardDescription>Assign a special fee type to a whole class or individual students.</CardDescription>
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
                                <div><Label>Select Class</Label><Select value={selectedClassId} onValueChange={setSelectedClassId}><SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger><SelectContent>{allStudents.map(s => s.class_id).filter((v,i,a)=>a.indexOf(v)===i && v).map(cid => <SelectItem key={cid} value={cid!}>{(allStudents.find(s=>s.class_id===cid) as any)?.class?.name || cid}</SelectItem>)}</SelectContent></Select></div>
                            ) : (
                                <div><Label>Select Students</Label><p className="text-xs text-muted-foreground">Multi-select student feature coming soon. Please use 'Class' for now.</p></div>
                            )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                           <div><Label>Fee Type to Assign</Label><Select value={assignFeeTypeId} onValueChange={setAssignFeeTypeId}><SelectTrigger><SelectValue placeholder="Select a fee type"/></SelectTrigger><SelectContent>{feeTypes.map(ft => <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>)}</SelectContent></Select></div>
                           <div><Label>Amount (₹)</Label><Input type="number" placeholder="Enter amount" value={assignAmount} onChange={e => setAssignAmount(Number(e.target.value))} required/></div>
                        </div>
                        <div><Label>Due Date (Optional)</Label><Input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} /></div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Fee
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="assigned-log">
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center">Assigned Fees Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-wrap gap-4">
                        <div className="flex-grow"><Label htmlFor="fee-type-filter"><Filter className="inline-block mr-1 h-3 w-3" />Filter by Fee Type</Label><Select value={feeTypeFilter} onValueChange={setFeeTypeFilter} disabled={isLoading}><SelectTrigger id="fee-type-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{feeTypes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                         <div className="flex-grow"><Label htmlFor="status-filter"><Filter className="inline-block mr-1 h-3 w-3" />Filter by Status</Label><Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}><SelectTrigger id="status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Overdue">Overdue</SelectItem></SelectContent></Select></div>
                    </div>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : filteredAssignedFees.length === 0 ? (<p className="text-muted-foreground text-center py-4">No fees assigned for this fee type match the current filters.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Type</TableHead><TableHead>Amount Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filteredAssignedFees.map(fee => (<TableRow key={fee.id}><TableCell className="font-medium">{fee.student.name}</TableCell><TableCell>{fee.fee_type.name}</TableCell><TableCell>₹{(fee.assigned_amount - fee.paid_amount).toFixed(2)}</TableCell><TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFeeType ? 'Edit' : 'Create New'} Special Fee Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-4">
              <div>
                <Label htmlFor="name">Fee Type (Internal Name)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., SCIENCE_FAIR_FEE" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g., Science Fair Participation Fee" required disabled={isSubmitting} />
              </div>
               <div>
                  <Label>Installment Type</Label>
                   <RadioGroup value={installmentType} onValueChange={(val) => setInstallmentType(val as FeeTypeInstallmentType)} className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="installments" id="type-installments"/><Label htmlFor="type-installments" className="font-normal">Installments</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="extra_charge" id="type-extra"/><Label htmlFor="type-extra" className="font-normal">Extra Charge</Label></div>
                    </RadioGroup>
              </div>
              <div>
                <Label htmlFor="feeCategoryId">Fee Category</Label>
                <Select value={selectedFeeCategoryId} onValueChange={setSelectedFeeCategoryId} required disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select a fee category" /></SelectTrigger>
                    <SelectContent>
                        {allFeeCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
               <div className="flex items-center space-x-2">
                <Checkbox id="isRefundable" checked={isRefundable} onCheckedChange={(checked) => setIsRefundable(!!checked)} disabled={isSubmitting}/>
                <Label htmlFor="isRefundable" className="font-normal">Is this fee refundable?</Label>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this fee type" disabled={isSubmitting} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingFeeType ? 'Save Changes' : 'Create Fee Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
