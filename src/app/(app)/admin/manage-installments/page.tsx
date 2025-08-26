
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Installment } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Layers, Loader2, MoreHorizontal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createInstallmentAction, updateInstallmentAction, deleteInstallmentAction, getInstallmentsAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function ManageInstallmentsPage() {
  const { toast } = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastDate, setLastDate] = useState('');
  const [description, setDescription] = useState('');

  const fetchInstallments = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const result = await getInstallmentsAction(schoolId);
      
    if (result.ok && result.installments) {
      setInstallments(result.installments);
    } else {
      toast({ title: "Error fetching installments", description: result.message || "An unknown error occurred", variant: "destructive" });
      setInstallments([]);
    }
    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchInstallments(schoolId);
        } else {
          toast({ title: "Error", description: "Your account is not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast, fetchInstallments]);

  const resetForm = () => {
    setTitle('');
    setStartDate('');
    setEndDate('');
    setLastDate('');
    setDescription('');
    setEditingInstallment(null);
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
    if (!title.trim() || !startDate || !endDate || !lastDate) {
      toast({ title: "Error", description: "Title and all dates are required.", variant: "destructive" });
      return;
    }
    if (!currentSchoolId) {
        toast({ title: "Error", description: "School context not found.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const installmentData = {
      title: title.trim(),
      start_date: startDate,
      end_date: endDate,
      last_date: lastDate,
      description: description.trim() || undefined,
      school_id: currentSchoolId,
    };

    let result;
    if (editingInstallment) {
      result = await updateInstallmentAction(editingInstallment.id, installmentData);
    } else {
      result = await createInstallmentAction(installmentData);
    }

    if (result.ok) {
      toast({ title: editingInstallment ? "Installment Updated" : "Installment Created", description: result.message });
      resetForm();
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchInstallments(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteInstallment = async (installmentId: string) => {
    if (!currentSchoolId) {
        toast({ title: "Error", description: "Cannot delete without school context.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await deleteInstallmentAction(installmentId, currentSchoolId);
    toast({ title: result.ok ? "Installment Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) {
      fetchInstallments(currentSchoolId);
    }
    setIsSubmitting(false);
  };
  
  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'N/A';
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Installments"
        description="Create and manage fee installment periods for your school."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/fees-management">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees
              </Link>
            </Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Installment
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Layers className="mr-2 h-5 w-5" />Installment Plans</CardTitle>
          <CardDescription>A list of all created fee installments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
            <p className="text-destructive text-center py-4">Your account is not associated with a school.</p>
          ) : installments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No installment plans have been created yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Last Date for Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((installment) => (
                  <TableRow key={installment.id}>
                    <TableCell className="font-medium">{installment.title}</TableCell>
                    <TableCell>{formatDate(installment.start_date)}</TableCell>
                    <TableCell>{formatDate(installment.end_date)}</TableCell>
                    <TableCell>{formatDate(installment.last_date)}</TableCell>
                    <TableCell className="text-right">
                       <AlertDialog>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenDialog(installment)}>
                                      <Edit2 className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <AlertDialogTrigger asChild>
                                      <DropdownMenuItem className="text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                  </AlertDialogTrigger>
                              </DropdownMenuContent>
                          </DropdownMenu>
                           <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the "{installment.title}" installment plan.
                                      This will fail if the plan is already linked to any fee payments.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteInstallment(installment.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInstallment ? 'Edit' : 'Create New'} Installment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., First Term, Q1 Fees" required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label htmlFor="start_date">Start Date</Label><Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isSubmitting} /></div>
                <div><Label htmlFor="end_date">End Date</Label><Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required disabled={isSubmitting} /></div>
              </div>
              <div>
                <Label htmlFor="last_date">Last Date for Payment</Label>
                <Input id="last_date" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this installment period" disabled={isSubmitting} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingInstallment ? 'Save Changes' : 'Create Installment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
