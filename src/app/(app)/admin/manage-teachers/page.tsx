
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Teacher } from '@/types';
import { useState } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Activity, Briefcase, UserPlus } from 'lucide-react';

// Mock data (can be moved to a shared location or fetched from an API later)
const initialTeachers: Teacher[] = [
  { id: 't1', name: 'John Smith', email: 'john.smith@example.com', subject: 'Mathematics', profilePictureUrl: 'https://placehold.co/40x40.png?text=JS' },
  { id: 't2', name: 'Emily Jones', email: 'emily.jones@example.com', subject: 'Science', profilePictureUrl: 'https://placehold.co/40x40.png?text=EJ' },
  { id: 't3', name: 'Michael Brown', email: 'michael.brown@example.com', subject: 'History' },
  { id: 't4', name: 'Sarah Davis', email: 'sarah.davis@example.com', subject: 'English', profilePictureUrl: 'https://placehold.co/40x40.png?text=SD' },
];

export default function ManageTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-teachers");

  // Form state for creating a new teacher
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherProfilePicUrl, setNewTeacherProfilePicUrl] = useState('');

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleEditTeacher = (teacher: Teacher) => { 
    alert(`Editing ${teacher.name}. Form/functionality to be implemented.`); 
  };
  
  const handleDeleteTeacher = (teacherId: string) => { 
    setTeachers(prev => prev.filter(t => t.id !== teacherId)); 
    alert(`Teacher ${teacherId} deleted (mock).`);
  };

  const handleCreateTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTeacher: Teacher = {
        id: String(Date.now()), // mock ID
        name: newTeacherName,
        email: newTeacherEmail,
        subject: newTeacherSubject,
        profilePictureUrl: newTeacherProfilePicUrl || undefined,
    };
    setTeachers(prev => [newTeacher, ...prev]);
    alert(`Teacher ${newTeacherName} created (mock).`);
    // Reset form
    setNewTeacherName('');
    setNewTeacherEmail('');
    setNewTeacherSubject('');
    setNewTeacherProfilePicUrl('');
    setActiveTab("list-teachers"); // Switch back to list after creation
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
                    <TableHead>Actions</TableHead>
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
                      <TableCell className="space-x-1">
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
              <CardDescription>Fill in the form below to add a new teacher.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateTeacherSubmit}>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="teacherName">Teacher Name</Label>
                  <Input id="teacherName" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="Full Name" required />
                </div>
                <div>
                  <Label htmlFor="teacherEmail">Email</Label>
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
                  <UserPlus className="mr-2 h-4 w-4" /> Save Teacher
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
