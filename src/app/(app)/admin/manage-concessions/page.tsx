
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Concession, Student, StudentFeePayment, ClassData, FeeCategory } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, BadgePercent, Loader2, MoreHorizontal, ArrowLeft, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createConcessionAction, updateConcessionAction, deleteConcessionAction, getManageConcessionsPageData, assignConcessionAction, getFeesForStudentsAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', userId).single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function ManageConcessionsPage() {
  const { toast } = useToast();
  const [concessions, setConcessions] = useState<Concession[]>([]);
  const [assignedConcessions, setAssignedConcessions] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [studentFees, setStudentFees] = useState<(StudentFeePayment & {fee_category: FeeCategory | null})[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

  // Form states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingConcession, setEditingConcession] = useState<Concession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // States for Assign Concession tab
  const [assignTargetType, setAssignTargetType] = useState<'individual' | 'class'>('individual');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedFeePaymentId, setSelectedFeePaymentId] = useState<string>('');
  const [selectedConcessionId, setSelectedConcessionId] = useState<string>('');
  const [concessionAmount, setConcessionAmount] = useState<number | ''>('');
  
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudents]);


  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getManageConcessionsPageData(schoolId);
      
    if (result.ok) {
        setConcessions(result.concessions || []);
        setAssignedConcessions(result.assignedConcessions || []);
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

  // Fetch student fees when a student is selected
  useEffect(() => {
    async function fetchFees() {
      if (selectedStudentId && currentSchoolId) {
        const result = await getFeesForStudentsAction([selectedStudentId], currentSchoolId);
        if (result.ok) setStudentFees(result.fees || []);
        else setStudentFees([]);
      } else {
        setStudentFees([]);
      }
      setSelectedFeePaymentId('');
    }
    fetchFees();
  }, [selectedStudentId, currentSchoolId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEditingConcession(null);
  };

  const handleOpenDialog = (concession?: Concession) => {
    if (concession) {
      setEditingConcession(concession);
      setTitle(concession.title);
      setDescription(concession.description || '');
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Title and school context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const concessionData = { 
      title: title.trim(),
      description: description.trim() || undefined,
      school_id: currentSchoolId 
    };

    let result = editingConcession ? await updateConcessionAction(editingConcession.id, concessionData) : await createConcessionAction(concessionData as any);
    if (result.ok) {
      toast({ title: editingConcession ? "Concession Updated" : "Concession Created", description: result.message });
      resetForm();
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteConcession = async (concessionId: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteConcessionAction(concessionId, currentSchoolId);
    toast({ title: result.ok ? "Concession Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) fetchPageData(currentSchoolId);
    setIsSubmitting(false);
  };
  
  const handleAssignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedFeePaymentId || !selectedConcessionId || concessionAmount === '' || !currentSchoolId || !currentAdminUserId) {
        toast({ title: "Error", description: "Please complete all fields in the assignment form.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await assignConcessionAction({
        student_id: selectedStudentId,
        fee_payment_id: selectedFeePaymentId,
        concession_id: selectedConcessionId,
        amount: Number(concessionAmount),
        school_id: currentSchoolId,
        applied_by_user_id: currentAdminUserId
    });
    if (result.ok) {
        toast({ title: "Concession Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId);
        setSelectedStudentId('');
        setSelectedFeePaymentId('');
        setSelectedConcessionId('');
        setConcessionAmount('');
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Concessions"
        description="Define concession types and apply them to student fees."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild><Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees</Link></Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}><PlusCircle className="mr-2 h-4 w-4" /> Add Concession</Button>
          </div>
        }
      />
      <Tabs defaultValue="assign">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assign">Assign Concession</TabsTrigger>
            <TabsTrigger value="types">Concession Types</TabsTrigger>
            <TabsTrigger value="log">Assignment Log ({assignedConcessions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="types">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><BadgePercent className="mr-2 h-5 w-5" />Defined Concession Types</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  : concessions.length === 0 ? <p className="text-muted-foreground text-center py-4">No concession types have been created yet.</p>
                  : <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{concessions.map((item) => (<TableRow key={item.id}><TableCell className="font-medium">{item.title}</TableCell><TableCell>{item.description}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(item)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the concession type "{item.title}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteConcession(item.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table>
                  }
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Fee Concession</CardTitle>
                    <CardDescription>Select a student, then choose which fee to apply a concession to.</CardDescription>
                </CardHeader>
                 <form onSubmit={handleAssignSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Assign To</Label>
                                <Select value={assignTargetType} onValueChange={(val) => { setAssignTargetType(val as any); setSelectedClassId(''); setSelectedStudentId(''); }}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="individual">Individual Student</SelectItem>
                                      <SelectItem value="class" disabled>Entire Class (Coming Soon)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Select Class</Label>
                                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={assignTargetType !== 'individual'}>
                                    <SelectTrigger><SelectValue placeholder="First, choose a class"/></SelectTrigger>
                                    <SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        {assignTargetType === 'individual' && (
                            <div>
                                <Label>Select Student</Label>
                                <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!selectedClassId || studentsInSelectedClass.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Choose a student from the selected class"/></SelectTrigger>
                                    <SelectContent>{studentsInSelectedClass.length > 0 ? (studentsInSelectedClass.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)) : (<SelectItem value="none" disabled>No students in this class</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Fee to Apply Concession To</Label>
                                <Select value={selectedFeePaymentId} onValueChange={setSelectedFeePaymentId} disabled={!selectedStudentId || studentFees.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Select student's pending fee"/></SelectTrigger>
                                    <SelectContent>{studentFees.map(fee => <SelectItem key={fee.id} value={fee.id}>{(fee.fee_category as any)?.name} - Due: ₹{(fee.assigned_amount - fee.paid_amount).toFixed(2)}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Concession Type</Label>
                                <Select value={selectedConcessionId} onValueChange={setSelectedConcessionId} required>
                                    <SelectTrigger><SelectValue placeholder="Select concession type"/></SelectTrigger>
                                    <SelectContent>{concessions.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Concession Amount (₹)</Label>
                            <Input type="number" placeholder="Enter amount to be waived" value={concessionAmount} onChange={e => setConcessionAmount(Number(e.target.value))} required step="0.01" min="0.01"/>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Apply Concession
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="log">
            <Card>
                 <CardHeader><CardTitle className="flex items-center">Assigned Concessions Log</CardTitle></CardHeader>
                <CardContent>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : assignedConcessions.length === 0 ? (<p className="text-muted-foreground text-center py-4">No concessions have been assigned yet.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Type</TableHead><TableHead>Concession</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{assignedConcessions.map(item => (<TableRow key={item.id}><TableCell>{item.student?.name || 'N/A'}</TableCell><TableCell>{item.fee_payment?.fee_category?.name || 'N/A'}</TableCell><TableCell>{item.concession?.title || 'N/A'}</TableCell><TableCell>₹{item.concession_amount.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingConcession ? 'Edit' : 'Create New'} Concession Type</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4"><div className="space-y-1"><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Sibling Discount, Scholarship" required disabled={isSubmitting} /></div><div className="space-y-1"><Label htmlFor="description">Description (Optional)</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the concession" disabled={isSubmitting}/></div></div>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingConcession ? 'Save Changes' : 'Create Concession'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
