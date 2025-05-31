
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Student } from '@/types';
import { useState } from 'react';
import { PlusCircle, Edit2, Trash2, Search, Users, FilePlus, Activity } from 'lucide-react';

// Mock data (can be moved to a shared location or fetched from an API later)
const initialStudents: Student[] = [
  { id: '1', name: 'Alice Wonderland', email: 'alice@example.com', classId: '10A', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
  { id: '2', name: 'Bob The Builder', email: 'bob@example.com', classId: '10B', profilePictureUrl: 'https://placehold.co/40x40.png?text=BB' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', classId: '11A' },
  { id: '4', name: 'Diana Prince', email: 'diana@example.com', classId: '10A', profilePictureUrl: 'https://placehold.co/40x40.png?text=DP' },
];

export default function ManageStudentsPage() {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-students");

  // Form state for creating a new student
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClassId, setNewStudentClassId] = useState('');
  const [newStudentProfilePicUrl, setNewStudentProfilePicUrl] = useState('');


  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleEditStudent = (student: Student) => { 
    alert(`Editing ${student.name}. Form/functionality to be implemented.`); 
  };
  
  const handleDeleteStudent = (studentId: string) => { 
    setStudents(prev => prev.filter(s => s.id !== studentId)); 
    alert(`Student ${studentId} deleted (mock).`);
  };

  const handleCreateStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newStudent: Student = {
        id: String(Date.now()), // mock ID
        name: newStudentName,
        email: newStudentEmail,
        classId: newStudentClassId,
        profilePictureUrl: newStudentProfilePicUrl || undefined,
    };
    setStudents(prev => [newStudent, ...prev]);
    alert(`Student ${newStudentName} created (mock).`);
    // Reset form
    setNewStudentName('');
    setNewStudentEmail('');
    setNewStudentClassId('');
    setNewStudentProfilePicUrl('');
    setActiveTab("list-students"); // Switch back to list after creation
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Students" 
        description="Administer student profiles, enrollment, and records." 
        actions={
          <Button onClick={() => setActiveTab("create-student")}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Student
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list-students"><Users className="mr-2 h-4 w-4" />List Students</TabsTrigger>
          <TabsTrigger value="create-student"><FilePlus className="mr-2 h-4 w-4" />Create Student</TabsTrigger>
          <TabsTrigger value="student-activity"><Activity className="mr-2 h-4 w-4" />Student Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="list-students">
          <Card>
            <CardHeader>
              <CardTitle>Student Roster</CardTitle>
              <CardDescription>View, search, and manage all student profiles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Search students by name or email..."
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
                    <TableHead>Class</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person portrait" />
                          <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.classId}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="outline" size="icon" onClick={() => handleEditStudent(student)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteStudent(student.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredStudents.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {searchTerm ? "No students match your search." : "No students found. Add a new student to get started."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-student">
          <Card>
            <CardHeader>
              <CardTitle>Create New Student</CardTitle>
              <CardDescription>Fill in the form below to add a new student.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateStudentSubmit}>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="studentName">Student Name</Label>
                  <Input id="studentName" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="Full Name" required />
                </div>
                <div>
                  <Label htmlFor="studentEmail">Email</Label>
                  <Input id="studentEmail" type="email" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} placeholder="student@example.com" required />
                </div>
                <div>
                  <Label htmlFor="studentClassId">Class ID</Label>
                  <Input id="studentClassId" value={newStudentClassId} onChange={(e) => setNewStudentClassId(e.target.value)} placeholder="e.g., 10A, Grade 5B" required />
                </div>
                <div>
                  <Label htmlFor="studentProfilePicUrl">Profile Picture URL (Optional)</Label>
                  <Input id="studentProfilePicUrl" value={newStudentProfilePicUrl} onChange={(e) => setNewStudentProfilePicUrl(e.target.value)} placeholder="https://placehold.co/100x100.png" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">
                  <FilePlus className="mr-2 h-4 w-4" /> Save Student
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="student-activity">
          <Card>
            <CardHeader>
              <CardTitle>Student Activity</CardTitle>
              <CardDescription>Overview of student activities and engagement.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Student activity tracking and reporting will be implemented here.</p>
              <p className="mt-2 text-sm">This section could include things like login history, assignment submission rates, forum participation, etc.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
