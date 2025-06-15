
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
import type { Teacher, User } from '@/types'; // Supabase does not use Prisma types directly
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Activity, Briefcase, UserPlus, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs'; // For hashing default password if creating user

const SALT_ROUNDS = 10;

// No MOCK_TEACHERS_KEY or MOCK_USER_DB_KEY for primary data source.
// Data will be fetched from Supabase.

export default function ManageTeachersPage() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]); // Teacher type from your @/types
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-teachers");
  const [isLoading, setIsLoading] = useState(true);

  // For Create Teacher Tab
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherProfilePicUrl, setNewTeacherProfilePicUrl] = useState('');

  // For Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherSubject, setEditTeacherSubject] = useState('');
  const [editTeacherProfilePicUrl, setEditTeacherProfilePicUrl] = useState('');


  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    setIsLoading(true);
    // Fetch from 'teachers' table and potentially join with 'users' for login email
    // This depends on how your 'teachers' and 'users' tables are structured.
    // Assuming 'teachers' has profile info (name, subject, profile_pic_url) and a 'user_id'.
    // And 'users' has 'email'.
    const { data, error } = await supabase
      .from('teachers') // Assuming your teacher profiles are in 'teachers' table
      .select(`
        id, 
        name, 
        subject, 
        profile_picture_url,
        user_id,
        users ( email ) 
      `); // Adjust if your user relation or email field is different

    if (error) {
      console.error("Error fetching teachers:", error);
      toast({ title: "Error", description: "Failed to fetch teacher data.", variant: "destructive" });
      setTeachers([]);
    } else {
      // Map Supabase data to your Teacher type
      const formattedTeachers = data?.map(t => ({
        id: t.id,
        name: t.name,
        email: t.users?.email || 'N/A', // Get email from joined users table
        subject: t.subject,
        profilePictureUrl: t.profile_picture_url,
        userId: t.user_id, // Store the linked user_id for edit/delete operations
        // Other fields like pastAssignmentsCount etc. would need separate queries
      })) || [];
      setTeachers(formattedTeachers);
    }
    setIsLoading(false);
  }

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleOpenEditDialog = (teacher: Teacher) => { 
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherEmail(teacher.email);
    setEditTeacherSubject(teacher.subject);
    setEditTeacherProfilePicUrl(teacher.profilePictureUrl || '');
    setIsEditDialogOpen(true);
  };

  const handleEditTeacherSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editTeacherName.trim() || !editTeacherEmail.trim() || !editTeacherSubject.trim()) {
      toast({ title: "Error", description: "Name, Email, and Subject cannot be empty.", variant: "destructive" });
      return;
    }

    // Check if email is being changed and if new email already exists for another user
    if (editTeacherEmail.trim() !== editingTeacher.email) {
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .eq('email', editTeacherEmail.trim())
            .neq('id', editingTeacher.userId) // Exclude current teacher's user record
            .single();
        if (fetchError && fetchError.code !== 'PGRST116') {
            toast({ title: "Error", description: "Database error checking email.", variant: "destructive" });
            return;
        }
        if (existingUser) {
            toast({ title: "Error", description: "Another user with this email already exists.", variant: "destructive" });
            return;
        }
    }
    
    // Update 'teachers' (profile) table
    const { error: teacherUpdateError } = await supabase
      .from('teachers')
      .update({ 
        name: editTeacherName.trim(), 
        subject: editTeacherSubject.trim(),
        profile_picture_url: editTeacherProfilePicUrl.trim() || `https://placehold.co/100x100.png?text=${editTeacherName.substring(0,1)}`
        // Note: Email is typically managed in the 'users' table. 
        // If your 'teachers' table also stores email, update it here.
      })
      .eq('id', editingTeacher.id);

    if (teacherUpdateError) {
      toast({ title: "Error", description: `Failed to update teacher profile: ${teacherUpdateError.message}`, variant: "destructive" });
      return;
    }

    // Update 'users' (login) table if userId is available
    if (editingTeacher.userId) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ name: editTeacherName.trim(), email: editTeacherEmail.trim() })
        .eq('id', editingTeacher.userId);
      
      if (userUpdateError) {
         toast({ title: "Warning", description: `Teacher profile updated, but failed to update login details: ${userUpdateError.message}`, variant: "default" });
      }
    } else {
        toast({ title: "Warning", description: "Teacher profile updated, but no linked user account found to update login details.", variant: "default" });
    }


    toast({ title: "Teacher Updated", description: `${editTeacherName.trim()}'s details updated.` });
    setIsEditDialogOpen(false);
    setEditingTeacher(null);
    fetchTeachers(); // Re-fetch to show updated data
  };
  
  const handleDeleteTeacher = async (teacher: Teacher) => { 
    if(confirm(`Are you sure you want to delete teacher ${teacher.name}? This will also remove their login access.`)) {
      // 1. Delete from 'teachers' (profile) table
      const { error: teacherDeleteError } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacher.id);

      if (teacherDeleteError) {
        toast({ title: "Error", description: `Failed to delete teacher profile: ${teacherDeleteError.message}`, variant: "destructive" });
        return;
      }

      // 2. Delete from 'users' (login) table if userId exists
      if (teacher.userId) {
        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', teacher.userId);
        if (userDeleteError) {
          toast({ title: "Warning", description: `Teacher profile deleted, but failed to delete login: ${userDeleteError.message}`, variant: "default" });
        }
      }
      
      toast({
        title: "Teacher Deleted",
        description: `${teacher.name} has been removed.`,
        variant: "destructive"
      });
      fetchTeachers(); // Re-fetch
    }
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherSubject.trim()) {
      toast({ title: "Error", description: "Name, Email, and Subject are required.", variant: "destructive" });
      return;
    }

    // Check if email already exists in 'users' table
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', newTeacherEmail.trim())
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        toast({ title: "Error", description: "Database error checking email.", variant: "destructive" });
        return;
    }
    if (existingUser) {
        toast({ title: "Error", description: "A user with this email already exists.", variant: "destructive" });
        return;
    }
    
    // 1. Create User record for login
    const newUserId = uuidv4();
    const defaultPassword = "password"; // Set a default password
    const hashedPassword = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: newUserId,
        email: newTeacherEmail.trim(),
        name: newTeacherName.trim(),
        role: 'teacher',
        password_hash: hashedPassword 
      })
      .select('id') // Select the ID of the newly created user
      .single();

    if (userInsertError || !newUser) {
      toast({ title: "Error", description: `Failed to create teacher login: ${userInsertError?.message || 'No user data returned'}`, variant: "destructive" });
      return;
    }

    // 2. Create Teacher profile record, linking to the User ID
    const newTeacherId = uuidv4(); // Teacher profile might have its own ID separate from User ID
    const { error: teacherInsertError } = await supabase
      .from('teachers')
      .insert({
        id: newTeacherId,
        user_id: newUser.id, // Link to the created user
        name: newTeacherName.trim(),
        subject: newTeacherSubject.trim(),
        profile_picture_url: newTeacherProfilePicUrl.trim() || `https://placehold.co/100x100.png?text=${newTeacherName.substring(0,1)}`,
        // email might be redundant if it's in the users table and joined
      });

    if (teacherInsertError) {
      toast({ title: "Error", description: `Failed to create teacher profile: ${teacherInsertError.message}`, variant: "destructive" });
      // Consider deleting the created user if teacher profile creation fails (rollback logic)
      await supabase.from('users').delete().eq('id', newUser.id);
      return;
    }
    
    toast({
      title: "Teacher Created",
      description: `${newTeacherName} has been added and a login account created with default password 'password'.`,
    });

    setNewTeacherName('');
    setNewTeacherEmail('');
    setNewTeacherSubject('');
    setNewTeacherProfilePicUrl('');
    setActiveTab("list-teachers"); 
    fetchTeachers(); // Refresh list
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Teachers" 
        description="Administer teacher profiles, assignments, and records." 
        actions={
          <Button onClick={() => setActiveTab("create-teacher")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Teacher
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list-teachers"><Briefcase className="mr-2 h-4 w-4" />List Teachers</TabsTrigger>
          <TabsTrigger value="create-teacher"><UserPlus className="mr-2 h-4 w-4" />Create Teacher</TabsTrigger>
          <TabsTrigger value="teacher-activity"><Activity className="mr-2 h-4 w-4" />Teacher Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="list-teachers">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Roster</CardTitle>
              <CardDescription>View, search, and manage all teacher profiles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Search teachers by name, email, or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading teachers...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Avatar</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <Avatar>
                            <AvatarImage src={teacher.profilePictureUrl || `https://placehold.co/40x40.png?text=${teacher.name.substring(0,2).toUpperCase()}`} alt={teacher.name} data-ai-hint="person portrait" />
                            <AvatarFallback>{teacher.name.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{teacher.name}</TableCell>
                        <TableCell>{teacher.email}</TableCell>
                        <TableCell>{teacher.subject}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(teacher)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteTeacher(teacher)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isLoading && filteredTeachers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {searchTerm ? "No teachers match your search." : "No teachers found. Add a new teacher to get started."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-teacher">
          <Card>
            <CardHeader>
              <CardTitle>Create New Teacher</CardTitle>
              <CardDescription>Fill in the form below to add a new teacher. This will create a login for them with default password "password".</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateTeacherSubmit}>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="teacherName">Teacher Name</Label>
                  <Input id="teacherName" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Full Name" required />
                </div>
                <div>
                  <Label htmlFor="teacherEmail">Email (Login ID)</Label>
                  <Input id="teacherEmail" type="email" value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} placeholder="teacher@example.com" required />
                </div>
                <div>
                  <Label htmlFor="teacherSubject">Subject</Label>
                  <Input id="teacherSubject" value={newTeacherSubject} onChange={(e) => setNewTeacherSubject(e.target.value)} placeholder="e.g., Mathematics, English" required />
                </div>
                <div>
                  <Label htmlFor="teacherProfilePicUrl">Profile Picture URL (Optional)</Label>
                  <Input id="teacherProfilePicUrl" value={newTeacherProfilePicUrl} onChange={(e) => setNewTeacherProfilePicUrl(e.target.value)} placeholder="https://placehold.co/100x100.png" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">
                  <UserPlus className="mr-2 h-4 w-4" /> Save Teacher & Create Account
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="teacher-activity">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Activity</CardTitle>
              <CardDescription>Overview of teacher activities and engagement.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Teacher activity tracking and reporting will be implemented here.</p>
              <p className="mt-2 text-sm">This section could include things like assigned classes, average student performance, resources shared, etc., by querying relevant Supabase tables.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Teacher: {editingTeacher?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditTeacherSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherName" className="text-right">Name</Label>
                <Input id="editTeacherName" value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherEmail" className="text-right">Email</Label>
                <Input id="editTeacherEmail" type="email" value={editTeacherEmail} onChange={(e) => setEditTeacherEmail(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherSubject" className="text-right">Subject</Label>
                <Input id="editTeacherSubject" value={editTeacherSubject} onChange={(e) => setEditTeacherSubject(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherProfilePicUrl" className="text-right">Profile URL</Label>
                <Input id="editTeacherProfilePicUrl" value={editTeacherProfilePicUrl} onChange={(e) => setEditTeacherProfilePicUrl(e.target.value)} className="col-span-3" placeholder="Optional image URL" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
