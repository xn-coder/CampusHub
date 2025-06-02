
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PayrollEntry } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, DollarSign, CheckCircle, CircleAlert } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

const MOCK_PAYROLL_DATA_KEY = 'mockPayrollData';

export default function PayrollPage() {
  const { toast } = useToast();
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<PayrollEntry> | null>(null);

  // Form state
  const [employeeName, setEmployeeName] = useState('');
  const [designation, setDesignation] = useState('');
  const [basicSalary, setBasicSalary] = useState<number | ''>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPayroll = localStorage.getItem(MOCK_PAYROLL_DATA_KEY);
      if (storedPayroll) {
        setPayrollEntries(JSON.parse(storedPayroll));
      }
    }
  }, []);

  const updateLocalStorage = (data: PayrollEntry[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_PAYROLL_DATA_KEY, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setEmployeeName('');
    setDesignation('');
    setBasicSalary('');
    setEditingEntry(null);
  };

  const handleOpenDialog = (entry?: PayrollEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setEmployeeName(entry.employeeName);
      setDesignation(entry.designation);
      setBasicSalary(entry.basicSalary);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!employeeName || !designation || basicSalary === '' || basicSalary <=0) {
      toast({ title: "Error", description: "Employee Name, Designation, and a valid Basic Salary are required.", variant: "destructive" });
      return;
    }

    let updatedEntries;
    if (editingEntry && editingEntry.id) {
      updatedEntries = payrollEntries.map(entry =>
        entry.id === editingEntry.id ? { ...entry, employeeName, designation, basicSalary: Number(basicSalary) } : entry
      );
      toast({ title: "Payroll Entry Updated", description: `Details for ${employeeName} updated.` });
    } else {
      const newEntry: PayrollEntry = {
        id: `pr-${Date.now()}`,
        employeeName, designation, 
        basicSalary: Number(basicSalary),
        status: 'Pending',
      };
      updatedEntries = [...payrollEntries, newEntry];
      toast({ title: "Payroll Entry Added", description: `New payroll entry for ${employeeName} added.` });
    }
    
    setPayrollEntries(updatedEntries);
    updateLocalStorage(updatedEntries);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Are you sure you want to delete this payroll entry?")) {
      const updatedEntries = payrollEntries.filter(entry => entry.id !== entryId);
      setPayrollEntries(updatedEntries);
      updateLocalStorage(updatedEntries);
      toast({ title: "Payroll Entry Deleted", variant: "destructive" });
    }
  };

  const handleMarkAsPaid = (entryId: string) => {
    const updatedEntries = payrollEntries.map(entry =>
      entry.id === entryId ? { ...entry, status: 'Paid' as const, paymentDate: new Date().toISOString() } : entry
    );
    setPayrollEntries(updatedEntries);
    updateLocalStorage(updatedEntries);
    toast({ title: "Marked as Paid", description: "Payroll entry updated to 'Paid'." });
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Payroll Management" 
        description="Manage staff salaries, payments, and payroll records."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Payroll Entry
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Payroll Records</CardTitle>
          <CardDescription>List of all staff payroll entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {payrollEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payroll entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.employeeName}</TableCell>
                    <TableCell>{entry.designation}</TableCell>
                    <TableCell>${entry.basicSalary.toFixed(2)}</TableCell>
                    <TableCell>
                       <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          entry.status === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          entry.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' // For 'Processing' or other states
                        }`}>
                          {entry.status}
                        </span>
                    </TableCell>
                    <TableCell>{entry.paymentDate ? format(new Date(entry.paymentDate), 'PP') : 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      {entry.status === 'Pending' && (
                        <Button variant="outline" size="sm" onClick={() => handleMarkAsPaid(entry.id)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Mark Paid
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" /> {editingEntry ? 'Edit' : 'Add New'} Payroll Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="employeeName" className="text-right">Employee</Label>
                <Input id="employeeName" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="col-span-3" placeholder="Full Name" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="designation" className="text-right">Designation</Label>
                <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} className="col-span-3" placeholder="e.g., Teacher, Accountant" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="basicSalary" className="text-right">Salary ($)</Label>
                <Input id="basicSalary" type="number" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value === '' ? '' : parseFloat(e.target.value))} className="col-span-3" placeholder="e.g., 50000" required min="0" step="0.01" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingEntry ? 'Save Changes' : 'Add Entry'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
