
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { FeeCategory } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Tags, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_FEE_CATEGORIES_KEY = 'mockFeeCategoriesData';

export default function FeeCategoriesPage() {
  const { toast } = useToast();
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCategories = localStorage.getItem(MOCK_FEE_CATEGORIES_KEY);
      if (storedCategories) setFeeCategories(JSON.parse(storedCategories));
      else localStorage.setItem(MOCK_FEE_CATEGORIES_KEY, JSON.stringify([]));
    }
  }, []);

  const updateLocalStorage = (data: FeeCategory[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_FEE_CATEGORIES_KEY, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAmount('');
    setEditingCategory(null);
  };

  const handleOpenDialog = (category?: FeeCategory) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setDescription(category.description);
      setAmount(category.amount ?? '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast({ title: "Error", description: "Name and Description are required.", variant: "destructive" });
      return;
    }

    let updatedCategories;
    const categoryData = {
      name: name.trim(),
      description: description.trim(),
      amount: amount === '' ? undefined : Number(amount),
    };

    if (editingCategory) {
      updatedCategories = feeCategories.map(cat =>
        cat.id === editingCategory.id ? { ...cat, ...categoryData } : cat
      );
      toast({ title: "Fee Category Updated", description: `${name.trim()} has been updated.` });
    } else {
      const newCategory: FeeCategory = {
        id: `fc-${Date.now()}`,
        ...categoryData,
      };
      updatedCategories = [newCategory, ...feeCategories];
      toast({ title: "Fee Category Added", description: `${name.trim()} has been added.` });
    }
    
    setFeeCategories(updatedCategories);
    updateLocalStorage(updatedCategories);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteCategory = (categoryId: string) => {
    // Potential: Check if category is in use by student fees before deleting
    if (confirm("Are you sure you want to delete this fee category?")) {
      const updatedCategories = feeCategories.filter(cat => cat.id !== categoryId);
      setFeeCategories(updatedCategories);
      updateLocalStorage(updatedCategories);
      toast({ title: "Fee Category Deleted", variant: "destructive" });
    }
  };
  
  const filteredCategories = feeCategories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fee Category Management"
        description="Organize and manage different fee structures and categories for the institution."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Fee Category
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Tags className="mr-2 h-5 w-5" />Fee Categories</CardTitle>
          <CardDescription>Define and manage various fee types (e.g., tuition, lab, sports, library).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
             <Input 
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
           </div>
          {filteredCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm && feeCategories.length > 0 ? "No categories match your search." : "No fee categories defined yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount (Optional)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.description}</TableCell>
                    <TableCell>{category.amount !== undefined ? `$${category.amount.toFixed(2)}` : 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(category)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteCategory(category.id)}>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit' : 'Add New'} Fee Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">Category Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tuition Fee, Lab Fee" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the fee" required />
              </div>
              <div>
                <Label htmlFor="amount">Amount (Optional)</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 100.00" step="0.01" min="0" />
                <p className="text-xs text-muted-foreground mt-1">Leave blank if the amount varies or is calculated elsewhere.</p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingCategory ? 'Save Changes' : 'Add Category'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
