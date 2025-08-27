
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Expense, ExpenseCategory } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Wallet, Loader2, Search, Download, ExternalLink, FileText, MoreHorizontal, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { DateRange } from 'react-day-picker';

const chartConfig = {
  amount: { label: "Amount", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .single();
  if (error || !user?.school_id) {
    return null;
  }
  return user.school_id;
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
    const [filterPreset, setFilterPreset] = useState('this_month');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfDay(new Date(new Date().setDate(1))),
      to: endOfDay(new Date()),
    });

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
            fetchUserSchoolId(adminId).then(schoolId => {
                setCurrentSchoolId(schoolId);
                if (schoolId) {
                    loadPageData(schoolId);
                } else {
                    toast({ title: "Error", description: "User not linked to a school.", variant: "destructive" });
                    setIsLoading(false);
                }
            });
        } else {
            toast({ title: "Error", description: "User not identified.", variant: "destructive" });
            setIsLoading(false);
        }
    }, [toast, loadPageData]);
    
    const handleFilterChange = (value: string) => {
        setFilterPreset(value);
        const now = new Date();
        if (value === 'this_year') {
          setDateRange({ from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) });
        } else if (value === 'this_month') {
          setDateRange({ from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) });
        } else if (value === 'last_7_days') {
          setDateRange({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) });
        }
    };
    
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
        if (!currentSchoolId) return;
        setIsSubmitting(true);
        const result = await deleteExpenseAction(expenseId, currentSchoolId);
        toast({ title: result.ok ? "Expense Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
        if (result.ok && currentSchoolId) await loadPageData(currentSchoolId);
        setIsSubmitting(false);
    };

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const matchesCategory = categoryFilter === 'all' || exp.category_id === categoryFilter;
            
            const expDate = parseISO(exp.date);
            const matchesDate = dateRange?.from && dateRange?.to ? expDate >= dateRange.from && expDate <= dateRange.to : true;

            const matchesSearch = searchTerm === '' ||
                exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));

            return matchesCategory && matchesDate && matchesSearch;
        });
    }, [expenses, categoryFilter, dateRange, searchTerm]);
    
    const chartData = useMemo(() => {
        const dataByCategory = filteredExpenses.reduce((acc, expense) => {
            const categoryName = getCategoryName(expense.category_id);
            acc[categoryName] = (acc[categoryName] || 0) + expense.amount;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(dataByCategory).map(([name, amount]) => ({ name, amount }));
    }, [filteredExpenses, categories]);


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
            
            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
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
                                <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterPreset} onValueChange={handleFilterChange}>
                                <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="this_month">This Month</SelectItem>
                                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                    <SelectItem value="this_year">This Year</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>
                             {filterPreset === 'custom' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={"outline"} className="w-full justify-start text-left font-normal md:w-auto">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}` : format(dateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={1}/>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                        {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Category</TableHead>
                                        <TableHead>Receipt</TableHead><TableHead className="text-right">Amount (₹)</TableHead>
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
                                                {expense.receipt_url ? (<a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a>) : 'None'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">₹{expense.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild><Link href={`/admin/expenses/${expense.id}/voucher`}><FileText className="mr-2 h-4 w-4" /> View Voucher</Link></DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleOpenDialog(expense)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                            <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the expense record for "{expense.title}".</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(expense.id)} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        {!isLoading && filteredExpenses.length === 0 && <p className="text-center text-muted-foreground py-4">No expenses found matching your criteria.</p>}
                    </CardContent>
                </Card>
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader><CardTitle>Expenses by Category</CardTitle><CardDescription>For selected date range.</CardDescription></CardHeader>
                        <CardContent>
                            {isLoading ? <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div> :
                             chartData.length === 0 ? <p className="text-muted-foreground text-center py-10">No expense data for selected period.</p> :
                             <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                                <BarChart accessibilityLayer data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} className="text-xs" width={80} interval={0} />
                                    <XAxis dataKey="amount" type="number" hide />
                                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={(value) => `₹${Number(value).toFixed(2)}`} content={<ChartTooltipContent indicator="line" />}/>
                                    <Bar dataKey="amount" layout="vertical" fill="var(--color-amount)" radius={4} />
                                </BarChart>
                             </ChartContainer>
                            }
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingExpense ? 'Edit' : 'Add New'} Expense</DialogTitle></DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="amount">Amount (₹)</Label><Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required disabled={isSubmitting}/></div>
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
