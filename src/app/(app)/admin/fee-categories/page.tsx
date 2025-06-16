
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
import { PlusCircle, Edit2, Trash2, Save, Tags, Search, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createFeeCategoryAction, updateFeeCategoryAction, deleteFeeCategoryAction, getFeeCategoriesAction } from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export default function FeeCategoriesPage() {
  const { toast } = useToast();
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchFeeCategories(schoolId);
        } else {
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast]);

  async function fetchFeeCategories(schoolId: string) {
    setIsLoading(true);
    const result = await getFeeCategoriesAction(schoolId);
      
    if (result.ok && result.categories) {
      setFeeCategories(result.categories);
    } else {
      toast({ title: "Error fetching fee categories", description: result.message || "An unknown error occurred", variant: "destructive" });
      setFeeCategories([]);
    }
    setIsLoading(false);
  }

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
      setDescription(category.description || '');
      setAmount(category.amount ?? '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Error", description: "Category Name is required.", variant: "destructive" });
      return;
    }
    if (!currentSchoolId) {
        toast({ title: "Error", description: "School context not found.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);

    const categoryData = {
      name: name.trim(),
      description: description.trim() || undefined,
      amount: amount === '' || amount === undefined ? undefined : Number(amount),
      school_id: currentSchoolId,
    };

    let result;
    if (editingCategory) {
      result = await updateFeeCategoryAction(editingCategory.id, categoryData);
    } else {
      result = await createFeeCategoryAction(categoryData);
    }

    if (result.ok) {
      toast({ title: editingCategory ? "Fee Category Updated" : "Fee Category Added", description: result.message });
      resetForm();
      setIsDialogOpen(false);
      if (currentSchoolId) fetchFeeCategories(currentSchoolId); // Re-fetch after action
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    if (!currentSchoolId) return;
    if (confirm("Are you sure you want to delete this fee category?")) {
      setIsSubmitting(true);
      const result = await deleteFeeCategoryAction(categoryId, currentSchoolId);
      toast({ title: result.ok ? "Fee Category Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok && currentSchoolId) {
        fetchFeeCategories(currentSchoolId); // Re-fetch after action
      }
      setIsSubmitting(false);
    }
  };
  
  const filteredCategories = feeCategories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fee Category Management"
        description="Organize and manage different fee structures and categories for the institution."
        actions={
          <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
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
                disabled={isLoading}
            />
           </div>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
            <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage fee categories.</p>
          ) : filteredCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm && feeCategories.length > 0 ? "No categories match your search." : "No fee categories defined yet for this school."}
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
                    <TableCell>{category.description || 'N/A'}</TableCell>
                    <TableCell>{category.amount !== undefined && category.amount !== null ? `$${category.amount.toFixed(2)}` : 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(category)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteCategory(category.id)} disabled={isSubmitting}>
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tuition Fee, Lab Fee" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the fee" disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="amount">Amount (Optional)</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 100.00" step="0.01" min="0" disabled={isSubmitting}/>
                <p className="text-xs text-muted-foreground mt-1">Leave blank if the amount varies or is calculated elsewhere.</p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingCategory ? 'Save Changes' : 'Add Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    