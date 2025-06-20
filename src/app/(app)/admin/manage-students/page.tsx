
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Student, User, ClassData } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { Edit2, Trash2, Search, Users, Activity, Save, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; 

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school or admin not linked:", error?.message || "No school record found for this admin_user_id.");
    return null;
  }
  return school.id;
}

export default function ManageStudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-students");
  const [isLoading, setIsLoading] = useState(true);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [allClassesInSchool, setAllClassesInSchool] = useState<ClassData[]>([]);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentClassId, setEditStudentClassId] = useState<string | undefined>(undefined);


  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchClasses(schoolId);
          fetchStudents(schoolId);
        } else {
          setIsLoading(false);
          toast({ title: "Error", description: "Admin not linked to a school. Cannot manage students.", variant: "destructive"});
        }
      });
    } else {
      setIsLoading(false);
      toast({ title: "Error", description: "Admin user ID not found. Please log in.", variant: "destructive"});
    }
  }, [toast]);

  async function fetchClasses(schoolId: string) {
     const { data, error } = await supabase
      .from('classes')
      .select('id, name, division')
      .eq('school_id', schoolId);
    if (error) {
      console.error("Error fetching classes:", error);
      toast({ title: "Error", description: "Failed to fetch class data.", variant: "destructive" });
    } else {
      setAllClassesInSchool(data || []);
    }
  }

  async function fetchStudents(schoolId: string) {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, name, email, class_id, profile_picture_url, user_id, school_id') 
      .eq('school_id', schoolId);

    if (error) {
      console.error("Error fetching students:", error);
      toast({ title: "Error", description: "Failed to fetch student data.", variant: "destructive" });
      setStudents([]);
    } else {
      const formattedStudents = data?.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email || 'N/A',
        classId: s.class_id || '', 
        profilePictureUrl: s.profile_picture_url,
        userId: s.user_id, 
        school_id: s.school_id 
      })) || [];
      setStudents(formattedStudents);
    }
    setIsLoading(false);
  }

  const getClassDisplayName = (classId?: string | null): string => {
    if (!classId) return 'N/A';
    const cls = allClassesInSchool.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const handleOpenEditDialog = (student: Student) => { 
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentEmail(student.email);
    setEditStudentClassId(student.class_id || undefined);
    setIsEditDialogOpen(true);
  };

  const handleEditStudentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editStudentName.trim() || !editStudentEmail.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, and School context are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    
    
    if (editStudentEmail.trim() !== editingStudent.email) {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', editStudentEmail.trim())
        .eq('school_id', currentSchoolId) 
        .neq('id', editingStudent.user_id) 
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { 
        toast({ title: "Error", description: "Database error checking email.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (existingUser) {
        toast({ title: "Error", description: "Another user with this email already exists in this school.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
    }

    const { error: studentUpdateError } = await supabase
      .from('students')
      .update({ 
        name: editStudentName.trim(), 
        email: editStudentEmail.trim(),
        class_id: editStudentClassId === 'unassign' ? null : editStudentClassId 
      })
      .eq('id', editingStudent.id)
      .eq('school_id', currentSchoolId);

    if (studentUpdateError) {
      toast({ title: "Error", description: `Failed to update student profile: ${studentUpdateError.message}`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    if (editingStudent.user_id) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ name: editStudentName.trim(), email: editStudentEmail.trim() })
        .eq('id', editingStudent.user_id); 
      
      if (userUpdateError) {
        toast({ title: "Warning", description: `Student profile updated, but failed to update user login details: ${userUpdateError.message}`, variant: "default" });
      }
    }
    
    toast({ title: "Student Updated", description: `${editStudentName.trim()}'s details updated.` });
    setIsEditDialogOpen(false);
    setEditingStudent(null);
    if(currentSchoolId) fetchStudents(currentSchoolId); 
    setIsLoading(false);
  };
  
  const handleDeleteStudent = async (student: Student) => { 
    if (!currentSchoolId) return;
    if (confirm(`Are you sure you want to delete ${student.name}? This will also remove their login access.`)) {
      setIsLoading(true);
      const { error: studentDeleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id)
        .eq('school_id', currentSchoolId);

      if (studentDeleteError) {
        toast({ title: "Error", description: `Failed to delete student profile: ${studentDeleteError.message}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (student.user_id) {
        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', student.user_id);
        if (userDeleteError) {
          toast({ title: "Warning", description: `Student profile deleted, but failed to delete user login: ${userDeleteError.message}`, variant: "default" });
        }
      }
      
      toast({
        title: "Student Deleted",
        description: `${student.name} has been removed.`,
        variant: "destructive"
      });
      if(currentSchoolId) fetchStudents(currentSchoolId); 
      setIsLoading(false);
    }
  };

  if (!currentSchoolId && !isLoading) {
    return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Manage Students" />
        <Card><CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot manage students.</CardContent></Card>
        </div>
    );
  }

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
              <CardDescription>View, search, and manage enrolled student profiles. New students are registered by teachers via their portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                  disabled={isLoading}
                />
              </div>
              {isLoading && !currentSchoolId ? (
                 <p className="text-center text-muted-foreground py-4">Identifying admin school...</p>
              ) : isLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading students...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Avatar</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Avatar>
                            <AvatarImage src={student.profile_picture_url || `https://placehold.co/40x40.png?text=${student.name.substring(0,2).toUpperCase()}`} alt={student.name} data-ai-hint="person portrait" />
                            <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{getClassDisplayName(student.class_id)}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(student)} disabled={isLoading}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteStudent(student)} disabled={isLoading}>
                            {isLoading && editingStudent?.id === student.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isLoading && filteredStudents.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {searchTerm ? "No students match your search." : "No students found for this school. Teachers can register new students."}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Student: {editingStudent?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditStudentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentName" className="text-right">Name</Label>
                <Input id="editStudentName" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="col-span-3" required disabled={isLoading} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentEmail" className="text-right">Email</Label>
                <Input id="editStudentEmail" type="email" value={editStudentEmail} onChange={(e) => setEditStudentEmail(e.target.value)} className="col-span-3" required disabled={isLoading} />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentClassId" className="text-right">Assign Class</Label>
                 <Select value={editStudentClassId} onValueChange={(value) => setEditStudentClassId(value === 'unassign' ? undefined : value)} disabled={isLoading}>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unassign">Unassign from Class</SelectItem>
                        {allClassesInSchool.map(cls => (
                            <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                        ))}
                        {allClassesInSchool.length === 0 && <SelectItem value="no-classes" disabled>No classes available in this school</SelectItem>}
                    </SelectContent>
                 </Select>
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


