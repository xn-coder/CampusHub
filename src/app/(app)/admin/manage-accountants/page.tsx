
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Accountant } from '@/types'; 
import { useState, useEffect, type FormEvent, type ChangeEvent, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Briefcase, UserPlus, Save, Loader2, FileDown, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createAccountantAction, updateAccountantAction, deleteAccountantAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ban } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: userRec, error: userErr } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', adminUserId)
    .single();
  
  if (userErr && userErr.code !== 'PGRST116') {
    console.error("Error fetching user record for school ID:", userErr.message);
    return null;
  }
  
  if (userRec?.school_id) {
    return userRec.school_id;
  }
  
  // Fallback for older setups or different admin linking methods
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();

  if (schoolError && schoolError.code !== 'PGRST116') {
    console.error("Error during fallback school fetch for admin:", schoolError.message);
  }

  return school?.id || null;
}


export default function ManageAccountantsPage() {
  const { toast } = useToast();
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-accountants");
  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageError, setPageError] = useState<string | null>(null);

  const [newAccountantName, setNewAccountantName] = useState('');
  const [newAccountantEmail, setNewAccountantEmail] = useState('');
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccountant, setEditingAccountant] = useState<Accountant | null>(null);
  const [editAccountantName, setEditAccountantName] = useState('');
  const [editAccountantEmail, setEditAccountantEmail] = useState('');
  

  useEffect(() => {
    const adminIdFromStorage = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminIdFromStorage);

    if (adminIdFromStorage) {
      fetchAdminSchoolId(adminIdFromStorage).then(fetchedSchoolId => {
        setCurrentSchoolId(fetchedSchoolId);
        if (fetchedSchoolId) {
          fetchAccountants(fetchedSchoolId); 
        } else {
          setIsLoading(false); 
          toast({ title: "School Not Found", description: "Admin not linked to a school. Cannot manage accountants.", variant: "destructive"});
        }
      });
    } else {
       setIsLoading(false); 
       toast({ title: "Authentication Error", description: "Admin user ID not found. Please log in.", variant: "destructive"});
    }
  }, [toast]); 

  async function fetchAccountants(schoolId: string) {
    setIsLoading(true); 
    setPageError(null);
    const { data, error } = await supabase 
      .from('accountants')
      .select('*')
      .eq('school_id', schoolId);

    if (error) {
      let friendlyMessage = `Failed to fetch accountant data: ${error.message}`;
      if (error.message.includes('relation "public.accountants" does not exist')) {
        friendlyMessage = "The 'accountants' table is missing from the database. Please run the necessary database migration to enable this feature.";
        setPageError(friendlyMessage);
      }
      toast({ title: "Database Error", description: friendlyMessage, variant: "destructive", duration: 10000 });
      setAccountants([]);
    } else {
      setAccountants(data || []);
    }
    setIsLoading(false); 
  }

  const filteredAccountants = useMemo(() => 
    accountants.filter(accountant =>
      (accountant.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (accountant.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [accountants, searchTerm]);

  const paginatedAccountants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAccountants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAccountants, currentPage]);
  const totalPages = Math.ceil(filteredAccountants.length / ITEMS_PER_PAGE);

  
  const handleOpenEditDialog = (accountant: Accountant) => { 
    setEditingAccountant(accountant);
    setEditAccountantName(accountant.name);
    setEditAccountantEmail(accountant.email);
    setIsEditDialogOpen(true);
  };

  const handleEditAccountantSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAccountant || !editAccountantName.trim() || !editAccountantEmail.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, and School context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const result = await updateAccountantAction({
      id: editingAccountant.id,
      userId: editingAccountant.user_id,
      name: editAccountantName,
      email: editAccountantEmail,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Accountant Updated", description: result.message });
      setIsEditDialogOpen(false);
      setEditingAccountant(null);
      if(currentSchoolId) fetchAccountants(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteAccountant = async (accountant: Accountant) => { 
    if (!currentSchoolId) return;
    if(confirm(`Are you sure you want to delete accountant ${accountant.name}? This will also remove their login access.`)) {
      setIsSubmitting(true);
      const result = await deleteAccountantAction(accountant.id, accountant.user_id, currentSchoolId);
      if (result.ok) {
        toast({ title: "Accountant Deleted", description: result.message, variant: "destructive" });
        if(currentSchoolId) fetchAccountants(currentSchoolId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };

  const handleCreateAccountantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountantName.trim() || !newAccountantEmail.trim()) {
      toast({ title: "Error", description: "Name and Email are required.", variant: "destructive" });
      return;
    }
    if (!currentSchoolId) { 
      toast({ title: "Error", description: "School context not found. Cannot create accountant.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const result = await createAccountantAction({
      name: newAccountantName,
      email: newAccountantEmail,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Accountant Created", description: result.message });
      setNewAccountantName('');
      setNewAccountantEmail('');
      setActiveTab("list-accountants"); 
      if(currentSchoolId) fetchAccountants(currentSchoolId);
    } else {
       toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  if (!currentSchoolId && !isLoading) { 
    return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Manage Accountants" />
        <Card><CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot manage accountants.</CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Accountants" 
        description="Administer accountant profiles and records." 
        actions={
          <Button onClick={() => setActiveTab("create-accountant")} disabled={isLoading || isSubmitting || !currentSchoolId || !!pageError}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Accountant
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list-accountants"><Briefcase className="mr-2 h-4 w-4" />List Accountants</TabsTrigger>
          <TabsTrigger value="create-accountant"><UserPlus className="mr-2 h-4 w-4" />Create Accountant</TabsTrigger>
        </TabsList>

        <TabsContent value="list-accountants">
          <Card>
            <CardHeader>
              <CardTitle>Accountant Roster</CardTitle>
              <CardDescription>View, search, and manage all accountant profiles.</CardDescription>
            </CardHeader>
            <CardContent>
              {pageError ? (
                <Alert variant="destructive">
                  <Ban className="h-4 w-4" />
                  <AlertTitle>Feature Unavailable</AlertTitle>
                  <AlertDescription>{pageError}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="flex-grow flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <Input 
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                        disabled={isLoading || !currentSchoolId}
                        />
                    </div>
                  </div>
                  {isLoading && <p className="text-center text-muted-foreground py-4">Loading accountants...</p>}
                  {!isLoading && currentSchoolId && paginatedAccountants.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      {searchTerm ? "No accountants match your search." : "No accountants found. Add a new one to get started."}
                    </p>
                  )}
                  {!isLoading && currentSchoolId && paginatedAccountants.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Avatar</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAccountants.map((accountant) => (
                          <TableRow key={accountant.id}>
                            <TableCell>
                              <Avatar>
                                <AvatarImage src={accountant.profile_picture_url || `https://placehold.co/40x40.png?text=${(accountant.name || 'AC').substring(0,2).toUpperCase()}`} alt={accountant.name || 'Accountant'} data-ai-hint="person portrait" />
                                <AvatarFallback>{(accountant.name || 'AC').substring(0,2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">{accountant.name}</TableCell>
                            <TableCell>{accountant.email}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={isSubmitting || isLoading}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onSelect={() => handleOpenEditDialog(accountant)}>
                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleDeleteAccountant(accountant)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
            {!pageError && totalPages > 1 && (
              <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1 || isLoading}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || isLoading}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="create-accountant">
          <Card>
            <CardHeader>
              <CardTitle>Create New Accountant</CardTitle>
              <CardDescription>Fill in the form below to add a new accountant. This will create a login for them with default password "password".</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateAccountantSubmit}>
              <CardContent className="space-y-4">
                 {pageError ? (
                    <Alert variant="destructive">
                        <Ban className="h-4 w-4" />
                        <AlertTitle>Feature Unavailable</AlertTitle>
                        <AlertDescription>{pageError}</AlertDescription>
                    </Alert>
                 ) : (
                    <>
                        <div>
                        <Label htmlFor="accountantName">Accountant Name</Label>
                        <Input id="accountantName" value={newAccountantName} onChange={(e) => setNewAccountantName(e.target.value)} placeholder="Full Name" required disabled={isSubmitting || !currentSchoolId}/>
                        </div>
                        <div>
                        <Label htmlFor="accountantEmail">Email (Login ID)</Label>
                        <Input id="accountantEmail" type="email" value={newAccountantEmail} onChange={(e) => setNewAccountantEmail(e.target.value)} placeholder="accountant@example.com" required disabled={isSubmitting || !currentSchoolId}/>
                        </div>
                    </>
                 )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isSubmitting || !currentSchoolId || !!pageError}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} 
                  Save Accountant & Create Account
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Accountant: {editingAccountant?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditAccountantSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editAccountantName" className="text-right">Name</Label>
                <Input id="editAccountantName" value={editAccountantName} onChange={(e) => setEditAccountantName(e.target.value)} className="col-span-3" required disabled={isSubmitting}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editAccountantEmail" className="text-right">Email</Label>
                <Input id="editAccountantEmail" type="email" value={editAccountantEmail} onChange={(e) => setEditAccountantEmail(e.target.value)} className="col-span-3" required disabled={isSubmitting}/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
