
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import type { ExpenseCategory } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Tags, Loader2, MoreHorizontal, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createExpenseCategoryAction, updateExpenseCategoryAction, deleteExpenseCategoryAction, getExpenseCategoriesAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

export default function ExpenseCategoriesPage() {
  const { toast } = useToast();
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [viewingCategory, setViewingCategory] = useState<ExpenseCategory | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchExpenseCategories(schoolId);
        } else {
          toast({ title: "Error", description: "Your account is not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
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

  const handleOpenDialog = (category?: ExpenseCategory, mode: 'edit' | 'view' = 'edit') => {
    if (mode === 'view') {
        setViewingCategory(category || null);
        setIsViewDialogOpen(true);
    } else {
        if (category) {
            setEditingCategory(category);
            setName(category.name);
            setDescription(category.description || '');
        } else {
            resetForm();
        }
        setIsFormDialogOpen(true);
    }
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
      setIsFormDialogOpen(false);
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
    setIsSubmitting(true);
    const result = await deleteExpenseCategoryAction(categoryId, currentSchoolId);
    toast({ title: result.ok ? "Category Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) {
      fetchExpenseCategories(currentSchoolId);
    }
    setIsSubmitting(false);
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
            <p className="text-destructive text-center py-4">Your account is not associated with a school. Cannot manage expense categories.</p>
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
                    <TableCell className="max-w-xs truncate" title={category.description}>{category.description || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <AlertDialog>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                      <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenDialog(category, 'view')}>
                                      <Eye className="mr-2 h-4 w-4" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleOpenDialog(category, 'edit')}>
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
                                      This action cannot be undone. This will permanently delete the "{category.name}" expense category.
                                      This will fail if the category is already assigned to any expense records.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>View Expense Category</DialogTitle>
            <DialogDescription>Details for expense category: {viewingCategory?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div>
                <Label>Category Name</Label>
                <p className="font-semibold text-lg">{viewingCategory?.name}</p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewingCategory?.description || 'No description provided.'}</p>
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
