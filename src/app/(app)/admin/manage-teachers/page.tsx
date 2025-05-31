
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Teacher, User } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Activity, Briefcase, UserPlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_TEACHERS_KEY = 'mockTeachersData'; // For storing teacher-specific data

export default function ManageTeachersPage() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-teachers");

  // Form state for creating a new teacher
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherProfilePicUrl, setNewTeacherProfilePicUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      if (storedTeachers) {
        setTeachers(JSON.parse(storedTeachers));
      } else {
        localStorage.setItem(MOCK_TEACHERS_KEY, JSON.stringify([]));
      }
       // Ensure mockUserDatabase exists
      if (!localStorage.getItem(MOCK_USER_DB_KEY)) {
        localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify([]));
      }
    }
  }, []);

  const updateLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };


  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleEditTeacher = (teacher: Teacher) => { 
    toast({ title: "Edit Teacher", description: `Editing ${teacher.name}. Form/functionality to be implemented.`});
  };
  
  const handleDeleteTeacher = (teacherId: string) => { 
    if(confirm("Are you sure you want to delete this teacher? This will also remove their login access.")) {
      const teacherToDelete = teachers.find(t => t.id === teacherId);
      if (!teacherToDelete) return;

      const updatedTeachers = teachers.filter(t => t.id !== teacherId);
      setTeachers(updatedTeachers);
      updateLocalStorage(MOCK_TEACHERS_KEY, updatedTeachers);

      // Remove from user database
      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as User[];
      const updatedUsers = storedUsers.filter(user => user.id !== teacherId);
      updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);

      toast({
        title: "Teacher Deleted",
        description: `${teacherToDelete.name} has been removed along with their login access.`,
        variant: "destructive"
      });
    }
  };

  const handleCreateTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName || !newTeacherEmail || !newTeacherSubject) {
      toast({ title: "Error", description: "Name, Email, and Subject are required.", variant: "destructive" });
      return;
    }

    const newTeacherId = `t-${Date.now()}`;
    const newTeacher: Teacher = {
        id: newTeacherId,
        name: newTeacherName,
        email: newTeacherEmail,
        subject: newTeacherSubject,
        profilePictureUrl: newTeacherProfilePicUrl || `https://placehold.co/100x100.png?text=${newTeacherName.substring(0,1)}`,
    };
    
    const newUser: User = {
      id: newTeacherId,
      email: newTeacherEmail,
      name: newTeacherName,
      role: 'teacher',
      password: 'password' // Default password
    };

    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      let users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      
      if (users.some(user => user.email === newTeacher.email)) {
         toast({
          title: "Error",
          description: "A user with this email already exists.",
          variant: "destructive",
        });
        return;
      }
      
      users.push(newUser);
      updateLocalStorage(MOCK_USER_DB_KEY, users);
    }
    
    const updatedTeachers = [newTeacher, ...teachers];
    setTeachers(updatedTeachers);
    updateLocalStorage(MOCK_TEACHERS_KEY, updatedTeachers);
    
    toast({
      title: "Teacher Created",
      description: `${newTeacherName} has been added and a login account created.`,
    });

    // Reset form
    setNewTeacherName('');
    setNewTeacherEmail('');
    setNewTeacherSubject('');
    setNewTeacherProfilePicUrl('');
    setActiveTab("list-teachers"); 
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
                  placeholder="Search teachers by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
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
                          <AvatarImage src={teacher.profilePictureUrl} alt={teacher.name} data-ai-hint="person portrait" />
                          <AvatarFallback>{teacher.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.email}</TableCell>
                      <TableCell>{teacher.subject}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button variant="outline" size="icon" onClick={() => handleEditTeacher(teacher)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteTeacher(teacher.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredTeachers.length === 0 && (
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
              <CardDescription>Fill in the form below to add a new teacher. This will create a login for them.</CardDescription>
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
              <p className="mt-2 text-sm">This section could include things like assigned classes, average student performance, resources shared, etc.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
