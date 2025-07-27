
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { ExpenseCategory } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Tags, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createExpenseCategoryAction, updateExpenseCategoryAction, deleteExpenseCategoryAction, getExpenseCategoriesAction } from './actions';

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

export default function ExpenseCategoriesPage() {
  const { toast } = useToast();
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchExpenseCategories(schoolId);
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

  async function fetchExpenseCategories(schoolId: string) {
    setIsLoading(true);
    const result = await getExpenseCategoriesAction(schoolId);
      
    if (result.ok && result.categories) {
      setExpenseCategories(result.categories);
    } else {
      toast({ title: "Error fetching categories", description: result.message || "An unknown error occurred", variant: "destructive" });
      setExpenseCategories([]);
    }
    setIsLoading(false);
  }

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingCategory(null);
  };

  const handleOpenDialog = (category?: ExpenseCategory) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setDescription(category.description || '');
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
      school_id: currentSchoolId,
    };

    let result;
    if (editingCategory) {
      result = await updateExpenseCategoryAction(editingCategory.id, categoryData);
    } else {
      result = await createExpenseCategoryAction(categoryData);
    }

    if (result.ok) {
      toast({ title: editingCategory ? "Category Updated" : "Category Added", description: result.message });
      resetForm();
      setIsDialogOpen(false);
      if (currentSchoolId) fetchExpenseCategories(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteCategory = async (categoryId: string) => {
    if (!currentSchoolId) {
        toast({ title: "Error", description: "Cannot delete category without school context.", variant: "destructive"});
        return;
    }
    if (confirm("Are you sure you want to delete this expense category?")) {
      setIsSubmitting(true);
      const result = await deleteExpenseCategoryAction(categoryId, currentSchoolId);
      toast({ title: result.ok ? "Category Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok && currentSchoolId) {
        fetchExpenseCategories(currentSchoolId);
      }
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expense Category Management"
        description="Organize and manage different expense categories for the institution."
        actions={
          <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Expense Category
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Tags className="mr-2 h-5 w-5" />Expense Categories</CardTitle>
          <CardDescription>Define and manage various expense types (e.g., Salaries, Utilities, Maintenance).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
            <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage expense categories.</p>
          ) : expenseCategories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No expense categories defined yet for this school.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>{category.description || 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(category)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteCategory(category.id)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
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
            <DialogTitle>{editingCategory ? 'Edit' : 'Add New'} Expense Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">Category Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Utilities, Salaries" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the expense category" disabled={isSubmitting} />
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
