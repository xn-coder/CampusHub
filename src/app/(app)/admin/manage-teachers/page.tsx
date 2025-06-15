
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
import type { Teacher, User } from '@/types'; 
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Activity, Briefcase, UserPlus, Save, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createTeacherAction, updateTeacherAction, deleteTeacherAction } from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school or admin not linked:", error);
    return null;
  }
  return school.id;
}

export default function ManageTeachersPage() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-teachers");
  const [isLoading, setIsLoading] = useState(true);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


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
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchTeachers(schoolId);
        } else {
          setIsLoading(false);
          toast({ title: "Error", description: "Admin not linked to a school. Cannot manage teachers.", variant: "destructive"});
        }
      });
    } else {
       setIsLoading(false);
       toast({ title: "Error", description: "Admin user ID not found. Please log in.", variant: "destructive"});
    }
  }, [toast]);

  async function fetchTeachers(schoolId: string) {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, email, subject, profile_picture_url, user_id')
      .eq('school_id', schoolId);

    if (error) {
      console.error("Error fetching teachers:", error);
      toast({ title: "Error", description: "Failed to fetch teacher data.", variant: "destructive" });
      setTeachers([]);
    } else {
      const formattedTeachers = data?.map(t => ({
        id: t.id, // Teacher Profile ID
        user_id: t.user_id, // User Login ID
        name: t.name,
        email: t.email, 
        subject: t.subject,
        profilePictureUrl: t.profile_picture_url,
        school_id: schoolId, // Already known
      })) || [];
      setTeachers(formattedTeachers);
    }
    setIsLoading(false);
  }

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.email && teacher.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (teacher.subject && teacher.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const handleOpenEditDialog = (teacher: Teacher) => { 
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherEmail(teacher.email);
    setEditTeacherSubject(teacher.subject || '');
    setEditTeacherProfilePicUrl(teacher.profilePictureUrl || '');
    setIsEditDialogOpen(true);
  };

  const handleEditTeacherSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editTeacherName.trim() || !editTeacherEmail.trim() || !editTeacherSubject.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, Subject, and School context are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    
    const result = await updateTeacherAction({
      id: editingTeacher.id,
      userId: editingTeacher.user_id,
      name: editTeacherName,
      email: editTeacherEmail,
      subject: editTeacherSubject,
      profilePictureUrl: editTeacherProfilePicUrl,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Teacher Updated", description: result.message });
      setIsEditDialogOpen(false);
      setEditingTeacher(null);
      if(currentSchoolId) fetchTeachers(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const handleDeleteTeacher = async (teacher: Teacher) => { 
    if (!currentSchoolId) return;
    if(confirm(`Are you sure you want to delete teacher ${teacher.name}? This will also remove their login access.`)) {
      setIsLoading(true);
      const result = await deleteTeacherAction(teacher.id, teacher.user_id, currentSchoolId);
      if (result.ok) {
        toast({ title: "Teacher Deleted", description: result.message, variant: "destructive" });
        if(currentSchoolId) fetchTeachers(currentSchoolId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsLoading(false);
    }
  };

  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherSubject.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, Subject, and School context are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const result = await createTeacherAction({
      name: newTeacherName,
      email: newTeacherEmail,
      subject: newTeacherSubject,
      profilePictureUrl: newTeacherProfilePicUrl,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Teacher Created", description: result.message });
      setNewTeacherName('');
      setNewTeacherEmail('');
      setNewTeacherSubject('');
      setNewTeacherProfilePicUrl('');
      setActiveTab("list-teachers"); 
      if(currentSchoolId) fetchTeachers(currentSchoolId);
    } else {
       toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (!currentSchoolId && !isLoading) {
    return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Manage Teachers" />
        <Card><CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot manage teachers.</CardContent></Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Teachers" 
        description="Administer teacher profiles, assignments, and records." 
        actions={
          <Button onClick={() => setActiveTab("create-teacher")} disabled={isLoading}>
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
                  disabled={isLoading}
                />
              </div>
              {isLoading && !currentSchoolId ? (
                  <p className="text-center text-muted-foreground py-4">Identifying admin school...</p>
              ) : isLoading ? (
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
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(teacher)} disabled={isLoading}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteTeacher(teacher)} disabled={isLoading}>
                             {isLoading && editingTeacher?.id === teacher.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
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
                  <Input id="teacherName" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Full Name" required disabled={isLoading}/>
                </div>
                <div>
                  <Label htmlFor="teacherEmail">Email (Login ID)</Label>
                  <Input id="teacherEmail" type="email" value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} placeholder="teacher@example.com" required disabled={isLoading}/>
                </div>
                <div>
                  <Label htmlFor="teacherSubject">Subject</Label>
                  <Input id="teacherSubject" value={newTeacherSubject} onChange={(e) => setNewTeacherSubject(e.target.value)} placeholder="e.g., Mathematics, English" required disabled={isLoading}/>
                </div>
                <div>
                  <Label htmlFor="teacherProfilePicUrl">Profile Picture URL (Optional)</Label>
                  <Input id="teacherProfilePicUrl" value={newTeacherProfilePicUrl} onChange={(e) => setNewTeacherProfilePicUrl(e.target.value)} placeholder="https://placehold.co/100x100.png" disabled={isLoading}/>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading || !currentSchoolId}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} 
                  Save Teacher & Create Account
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="teacher-activity">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Activity</CardTitle>
              <CardDescription>Overview of teacher activities and engagement (Placeholder).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Teacher activity tracking will be implemented here.</p>
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
                <Input id="editTeacherName" value={editTeacherName} onChange={(e) => setEditTeacherName(e.target.value)} className="col-span-3" required disabled={isLoading}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherEmail" className="text-right">Email</Label>
                <Input id="editTeacherEmail" type="email" value={editTeacherEmail} onChange={(e) => setEditTeacherEmail(e.target.value)} className="col-span-3" required disabled={isLoading}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherSubject" className="text-right">Subject</Label>
                <Input id="editTeacherSubject" value={editTeacherSubject} onChange={(e) => setEditTeacherSubject(e.target.value)} className="col-span-3" required disabled={isLoading}/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editTeacherProfilePicUrl" className="text-right">Profile URL</Label>
                <Input id="editTeacherProfilePicUrl" value={editTeacherProfilePicUrl} onChange={(e) => setEditTeacherProfilePicUrl(e.target.value)} className="col-span-3" placeholder="Optional image URL" disabled={isLoading}/>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

