
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import type { FeeCategory } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Tags, Loader2, Eye, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createFeeCategoryAction, updateFeeCategoryAction, deleteFeeCategoryAction, getFeeCategoriesAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';


async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .single();
  if (error || !user) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function FeeCategoriesPage() {
  const { toast } = useToast();
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | null>(null);
  const [viewingCategory, setViewingCategory] = useState<FeeCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');

  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(userId);
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchFeeCategories(schoolId);
        } else {
          toast({ title: "Error", description: "User not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
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

  const handleOpenDialog = (category?: FeeCategory, mode: 'edit' | 'view' = 'edit') => {
    if (mode === 'view') {
        setViewingCategory(category || null);
        setIsViewDialogOpen(true);
    } else { // 'edit' or 'create'
        if (category) {
            setEditingCategory(category);
            setName(category.name);
            setDescription(category.description || '');
            setAmount(category.amount ?? '');
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
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchFeeCategories(currentSchoolId); // Re-fetch after action
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
    const result = await deleteFeeCategoryAction(categoryId, currentSchoolId);
    toast({ title: result.ok ? "Fee Category Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) {
      fetchFeeCategories(currentSchoolId); // Re-fetch after action
    }
    setIsSubmitting(false);
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
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/fees-management">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees Management
              </Link>
            </Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Fee Category
            </Button>
          </div>
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
            <p className="text-destructive text-center py-4">User not associated with a school. Cannot manage fee categories.</p>
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
                    <TableCell className="max-w-xs truncate" title={category.description || ''}>{category.description || 'N/A'}</TableCell>
                    <TableCell>{category.amount !== undefined && category.amount !== null ? <><span className="font-mono">₹</span>{category.amount.toFixed(2)}</> : 'N/A'}</TableCell>
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
                                  <DropdownMenuSeparator />
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
                                      This action cannot be undone. This will permanently delete the "{category.name}" fee category.
                                      This will fail if the category is already assigned to any student fee records.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-destructive hover:bg-destructive/90">
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
                <Label htmlFor="amount">Amount (Optional, <span className="font-mono">₹</span>)</Label>
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>View Fee Category</DialogTitle>
            <DialogDescription>Details for fee category: {viewingCategory?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div>
                <Label>Category Name</Label>
                <p className="font-semibold text-lg">{viewingCategory?.name}</p>
              </div>
              <div>
                <Label>Amount</Label>
                <p className="font-mono text-base">{viewingCategory?.amount !== undefined && viewingCategory?.amount !== null ? `₹${viewingCategory.amount.toFixed(2)}` : 'Not set (Varies per assignment)'}</p>
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
