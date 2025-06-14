
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
import type { Student, User } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { Edit2, Trash2, Search, Users, Activity, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_ADMISSIONS_KEY = 'mockAdmissionsData'; 

export default function ManageStudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-students");

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      if (storedStudents) {
        setStudents(JSON.parse(storedStudents));
      } else {
        localStorage.setItem(MOCK_STUDENTS_KEY, JSON.stringify([])); 
      }

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

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const handleOpenEditDialog = (student: Student) => { 
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentEmail(student.email);
    setIsEditDialogOpen(true);
  };

  const handleEditStudentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editStudentName.trim() || !editStudentEmail.trim()) {
      toast({ title: "Error", description: "Name and Email cannot be empty.", variant: "destructive" });
      return;
    }
    
    const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as User[];
    if (editStudentEmail.trim() !== editingStudent.email && storedUsers.some(u => u.email === editStudentEmail.trim())) {
        toast({ title: "Error", description: "Another user with this email already exists.", variant: "destructive" });
        return;
    }

    const updatedStudents = students.map(s => 
      s.id === editingStudent.id ? { ...s, name: editStudentName.trim(), email: editStudentEmail.trim() } : s
    );
    setStudents(updatedStudents);
    updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

    const updatedUsers = storedUsers.map(u =>
      u.id === editingStudent.id ? { ...u, name: editStudentName.trim(), email: editStudentEmail.trim() } : u
    );
    updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);
    
    // Also update admission record if email changed and an admission record exists
    const storedAdmissions = JSON.parse(localStorage.getItem(MOCK_ADMISSIONS_KEY) || '[]') as any[];
    const updatedAdmissions = storedAdmissions.map(adm =>
      adm.email === editingStudent.email ? { ...adm, name: editStudentName.trim(), email: editStudentEmail.trim() } : adm
    );
    updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedAdmissions);


    toast({ title: "Student Updated", description: `${editStudentName.trim()}'s details updated.` });
    setIsEditDialogOpen(false);
    setEditingStudent(null);
  };
  
  const handleDeleteStudent = (studentId: string) => { 
    if (confirm("Are you sure you want to delete this student? This will also remove their login access and admission record if any.")) {
      const studentToDelete = students.find(s => s.id === studentId);
      if (!studentToDelete) return;

      const updatedStudents = students.filter(s => s.id !== studentId);
      setStudents(updatedStudents);
      updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as User[];
      const updatedUsers = storedUsers.filter(user => user.id !== studentId); 
      updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);
      
      const storedAdmissions = JSON.parse(localStorage.getItem(MOCK_ADMISSIONS_KEY) || '[]') as any[];
      const updatedAdmissions = storedAdmissions.filter(adm => adm.email !== studentToDelete.email);
      updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedAdmissions);

      toast({
        title: "Student Deleted",
        description: `${studentToDelete.name} has been removed along with their login and admission record.`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Students" 
        description="Administer enrolled student profiles and records." 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2"> 
          <TabsTrigger value="list-students"><Users className="mr-2 h-4 w-4" />List Students</TabsTrigger>
          <TabsTrigger value="student-activity"><Activity className="mr-2 h-4 w-4" />Student Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="list-students">
          <Card>
            <CardHeader>
              <CardTitle>Student Roster</CardTitle>
              <CardDescription>View, search, and manage enrolled student profiles. New students are registered by teachers.</CardDescription>
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
                    <TableHead>Class ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell>{student.classId || 'N/A'}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(student)}>
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
                  {searchTerm ? "No students match your search." : "No students found. Students are registered by teachers."}
                </p>
              )}
            </CardContent>
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

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Student: {editingStudent?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditStudentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentName" className="text-right">Name</Label>
                <Input id="editStudentName" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentEmail" className="text-right">Email</Label>
                <Input id="editStudentEmail" type="email" value={editStudentEmail} onChange={(e) => setEditStudentEmail(e.target.value)} className="col-span-3" required />
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
