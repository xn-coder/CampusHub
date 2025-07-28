
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Expense, ExpenseCategory } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Wallet, Loader2, Search, Download, ExternalLink, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import {
    getExpensesPageDataAction,
    createExpenseAction,
    updateExpenseAction,
    deleteExpenseAction,
    createReceiptUploadUrlAction
} from './actions';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    return null;
  }
  return school.id;
}

export default function ExpensesPage() {
    const { toast } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    
    // Form state
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState('');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const loadPageData = useCallback(async (schoolId: string) => {
        setIsLoading(true);
        const result = await getExpensesPageDataAction(schoolId);
        if (result.ok) {
            setExpenses(result.expenses || []);
            setCategories(result.categories || []);
        } else {
            toast({ title: "Error loading data", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
        const adminId = localStorage.getItem('currentUserId');
        setCurrentAdminUserId(adminId);
        setDate(format(new Date(), 'yyyy-MM-dd')); // Set date on mount
        if (adminId) {
            fetchAdminSchoolId(adminId).then(schoolId => {
                setCurrentSchoolId(schoolId);
                if (schoolId) {
                    loadPageData(schoolId);
                } else {
                    toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
                    setIsLoading(false);
                }
            });
        } else {
            toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
            setIsLoading(false);
        }
    }, [toast, loadPageData]);
    
    const resetForm = () => {
        setTitle(''); setAmount(''); setCategoryId(''); setDate(format(new Date(), 'yyyy-MM-dd')); setNotes(''); setReceiptFile(null);
        setEditingExpense(null); setUploadProgress(0);
    };

    const handleOpenDialog = (expense?: Expense) => {
        if (expense) {
            setEditingExpense(expense);
            setTitle(expense.title);
            setAmount(expense.amount);
            setCategoryId(expense.category_id);
            setDate(format(parseISO(expense.date), 'yyyy-MM-dd'));
            setNotes(expense.notes || '');
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file && file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ title: "File is too large", description: "Receipts must be smaller than 5MB.", variant: "destructive" });
            return;
        }
        setReceiptFile(file);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentSchoolId || !currentAdminUserId || !title || amount === '' || !categoryId || !date) {
            toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        let receiptUrl: string | undefined = editingExpense?.receipt_url || undefined;
        
        try {
            if (receiptFile) {
                const signedUrlResult = await createReceiptUploadUrlAction(currentSchoolId, receiptFile.name);
                if (!signedUrlResult.ok || !signedUrlResult.signedUrl) throw new Error(signedUrlResult.message);
                
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', signedUrlResult.signedUrl!, true);
                    xhr.setRequestHeader('Content-Type', receiptFile.type);
                    xhr.upload.onprogress = (event) => setUploadProgress((event.loaded / event.total) * 100);
                    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Upload failed'));
                    xhr.onerror = () => reject(new Error('Network error during upload'));
                    xhr.send(receiptFile);
                });
                receiptUrl = signedUrlResult.publicUrl;
            }

            const expenseData = {
                title, amount: Number(amount), category_id: categoryId, date, notes, receipt_url: receiptUrl,
                school_id: currentSchoolId, recorded_by_user_id: currentAdminUserId
            };

            const result = editingExpense
                ? await updateExpenseAction(editingExpense.id, expenseData)
                : await createExpenseAction(expenseData);

            if (result.ok) {
                toast({ title: editingExpense ? "Expense Updated" : "Expense Added", description: result.message });
                setIsDialogOpen(false); resetForm();
                if (currentSchoolId) await loadPageData(currentSchoolId);
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "Error during submission", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (expenseId: string) => {
        if (!currentSchoolId || !confirm("Are you sure you want to delete this expense record?")) return;
        setIsSubmitting(true);
        const result = await deleteExpenseAction(expenseId, currentSchoolId);
        toast({ title: result.ok ? "Expense Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
        if (result.ok && currentSchoolId) await loadPageData(currentSchoolId);
        setIsSubmitting(false);
    };

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';

    const filteredExpenses = expenses.filter(exp => {
        const matchesSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = categoryFilter === 'all' || exp.category_id === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expense Management"
                description="Track and manage all school expenditures."
                actions={
                    <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isLoading}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                    </Button>
                }
            />
            <Card>
                <CardHeader>
                    <CardTitle>Expense Records</CardTitle>
                    <CardDescription>View, filter, and manage all recorded expenses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="Search by title or notes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="md:w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Receipt</TableHead>
                                    <TableHead className="text-right">Amount (₹)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExpenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                        <TableCell>{format(parseISO(expense.date), 'PP')}</TableCell>
                                        <TableCell className="font-medium">{expense.title}</TableCell>
                                        <TableCell>{getCategoryName(expense.category_id)}</TableCell>
                                        <TableCell>
                                            {expense.receipt_url ? (
                                                <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            ) : 'None'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">₹{expense.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button asChild variant="outline" size="icon" title="View Voucher">
                                              <Link href={`/admin/expenses/${expense.id}/voucher`}><FileText className="h-4 w-4" /></Link>
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => handleOpenDialog(expense)} disabled={isSubmitting}><Edit2 className="h-4 w-4" /></Button>
                                            <Button variant="destructive" size="icon" onClick={() => handleDelete(expense.id)} disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {!isLoading && filteredExpenses.length === 0 && <p className="text-center text-muted-foreground py-4">No expenses found matching your criteria.</p>}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingExpense ? 'Edit' : 'Add New'} Expense</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="amount">Amount (₹)</Label><Input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="categoryId">Category</Label>
                                <Select value={categoryId} onValueChange={setCategoryId} required disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSubmitting}/></div>
                            <div><Label htmlFor="receiptFile">Receipt (Optional)</Label><Input id="receiptFile" type="file" onChange={handleFileChange} disabled={isSubmitting}/></div>
                            {isSubmitting && uploadProgress > 0 && <Progress value={uploadProgress} />}
                        </div>
                        <DialogFooter className="mt-4">
                            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingExpense ? 'Save Changes' : 'Add Expense'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
