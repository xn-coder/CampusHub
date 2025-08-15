
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2, Loader2, Save, ReceiptText, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { createReceiptAction, getReceiptsAction, type ReceiptDB, type ReceiptItemInput, type ReceiptItemDB } from './actions';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
  return user?.school_id || null;
}

const chartConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function ReceiptsPage() {
  const { toast } = useToast();
  const [allReceipts, setAllReceipts] = useState<ReceiptDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form state
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [narration, setNarration] = useState('');
  const [items, setItems] = useState<ReceiptItemInput[]>([{ ledger: '', description: '', amount: 0 }]);
  
  // Filtering state
  const [filterPreset, setFilterPreset] = useState('this_month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date(new Date().setDate(1))),
    to: endOfDay(new Date()),
  });

  const loadData = useCallback(async () => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      setCurrentUserId(userId);
      const schoolId = await fetchAdminSchoolId(userId);
      if (schoolId) {
        setCurrentSchoolId(schoolId);
        const result = await getReceiptsAction(schoolId);
        if (result.ok) setAllReceipts(result.receipts || []);
        else toast({ title: "Error", description: "Failed to load receipts.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
    }
    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (value: string) => {
    setFilterPreset(value);
    const now = new Date();
    if (value === 'this_year') {
      setDateRange({ from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) });
    } else if (value === 'this_month') {
      setDateRange({ from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) });
    } else if (value === 'last_7_days') {
      setDateRange({ from: startOfDay(subDays(now, 6)), to: endOfDay(now) });
    } else { // custom
      // Let the date picker handle it
    }
  };

  const filteredReceipts = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return allReceipts;
    return allReceipts.filter(receipt => {
        const receiptDate = parseISO(receipt.payment_date);
        return receiptDate >= dateRange.from! && receiptDate <= dateRange.to!;
    });
  }, [allReceipts, dateRange]);

  const chartData = useMemo(() => {
    const dataByPaymentMode = filteredReceipts.reduce((acc, receipt) => {
        const mode = receipt.payment_mode || 'Other';
        acc[mode] = (acc[mode] || 0) + receipt.total_amount;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(dataByPaymentMode).map(([name, amount]) => ({ name, amount }));
  }, [filteredReceipts]);


  const handleItemChange = (index: number, field: keyof ReceiptItemInput, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const handleAddItem = () => setItems([...items, { ledger: '', description: '', amount: 0 }]);

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId || !currentUserId || items.some(i => !i.ledger || i.amount <= 0)) {
      toast({ title: "Error", description: "Please fill all required fields in each item row.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await createReceiptAction({
      payment_date: paymentDate, payment_mode: paymentMode, narration, items,
      school_id: currentSchoolId, created_by_user_id: currentUserId,
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Success", description: "Receipt created successfully." });
      setItems([{ ledger: '', description: '', amount: 0 }]);
      setNarration('');
      loadData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Receipt Vouchers" description="Create and manage income receipts for various transactions." />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Create New Receipt Voucher</CardTitle>
            <CardDescription>Enter details for the income received. Add multiple ledger items as needed.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label htmlFor="paymentDate">Payment Date</Label><Input id="paymentDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required disabled={isSubmitting} /></div>
                <div><Label htmlFor="paymentMode">Payment Mode</Label><Input id="paymentMode" value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="e.g., Cash, Bank Transfer" required disabled={isSubmitting} /></div>
              </div>
              <div><Label htmlFor="narration">Narration</Label><Textarea id="narration" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Brief description of the transaction" disabled={isSubmitting} /></div>
              <div className="space-y-2 pt-2">
                <Label>Ledger Items</Label>
                <div className="border rounded-md"><Table>
                  <TableHeader><TableRow>
                    <TableHead>Ledger</TableHead><TableHead>Description</TableHead>
                    <TableHead className="w-[150px]">Amount (₹)</TableHead><TableHead className="w-[50px]"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell><Input placeholder="e.g., School Dairy" value={item.ledger} onChange={e => handleItemChange(index, 'ledger', e.target.value)} required /></TableCell>
                      <TableCell><Input placeholder="Optional details" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} /></TableCell>
                      <TableCell><Input type="number" placeholder="0.00" value={item.amount || ''} onChange={e => handleItemChange(index, 'amount', Number(e.target.value))} required min="0.01" step="0.01" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} disabled={items.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>))}
                  </TableBody>
                </Table></div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>
              </div>
              <div className="text-right font-bold text-lg">Total Amount: <span className="font-mono">₹{totalAmount.toFixed(2)}</span></div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || totalAmount <= 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Receipt
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader><CardTitle>Income by Payment Mode</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                     chartData.length === 0 ? <p className="text-muted-foreground text-center py-10">No receipt data for selected period.</p> :
                      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                        <BarChart
                          accessibilityLayer
                          data={chartData}
                          layout="vertical"
                          margin={{
                            left: 10,
                          }}
                        >
                          <CartesianGrid horizontal={false} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            className="text-xs"
                          />
                          <XAxis dataKey="amount" type="number" hide />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted))" }}
                            formatter={(value) => `₹${Number(value).toFixed(2)}`}
                            content={<ChartTooltipContent indicator="line" />}
                          />
                          <Bar dataKey="amount" layout="vertical" fill="var(--color-amount)" radius={4} />
                        </BarChart>
                      </ChartContainer>
                    }
                </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Receipts Log</CardTitle><CardDescription>A log of recently created receipts.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={filterPreset} onValueChange={handleFilterChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                                <Button id="date" variant={"outline"} className="w-full justify-start text-left font-normal">
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
                <div className="max-h-[500px] overflow-y-auto">
                    {isLoading ? <div className="text-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : filteredReceipts.length === 0 ? <p className="text-muted-foreground text-center">No receipts found.</p> : (
                    <ul className="space-y-2">{filteredReceipts.map(r => (
                        <li key={r.id} className="p-2 border rounded-md flex justify-between items-center">
                        <div>
                            <p className="font-medium">Receipt #{r.receipt_no}</p>
                            <p className="text-sm text-muted-foreground">₹{r.total_amount.toFixed(2)} - {format(parseISO(r.payment_date), 'PP')}</p>
                        </div>
                        <Button asChild variant="outline" size="sm"><Link href={`/admin/receipts/${r.id}/voucher`}><FileText className="mr-1 h-3 w-3" /> View</Link></Button>
                        </li>))}
                    </ul>)}
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
