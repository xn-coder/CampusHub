
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
import type { Student, User } from '@/types'; // Supabase does not use Prisma types directly
import { useState, useEffect, type FormEvent } from 'react';
import { Edit2, Trash2, Search, Users, Activity, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; // Import Supabase client

// No longer using MOCK_STUDENTS_KEY, MOCK_USER_DB_KEY, MOCK_ADMISSIONS_KEY for primary data source
// Data will be fetched from Supabase, though these keys might still be used for other mock parts not yet refactored.

export default function ManageStudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]); // Student type from your @/types
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("list-students");
  const [isLoading, setIsLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setIsLoading(true);
    // Fetch from 'students' table and join with 'users' table for email
    // This assumes your 'students' table has a 'user_id' linking to 'users.id'
    // and that 'students' table contains name, profile_picture_url, class_id.
    // 'users' table contains email.
    // Adjust select query based on your actual Supabase table structure.
    const { data, error } = await supabase
      .from('students') // Assuming your profiles are in 'students' table
      .select(`
        id, 
        name, 
        email, 
        class_id, 
        profile_picture_url, 
        date_of_birth,
        guardian_name,
        contact_number,
        address,
        admission_date,
        users ( id, email ) 
      `); // Adjust fields as per your 'students' and 'users' table structure

    if (error) {
      console.error("Error fetching students:", error);
      toast({ title: "Error", description: "Failed to fetch student data.", variant: "destructive" });
      setStudents([]);
    } else {
      // Map Supabase data to your Student type.
      // This example assumes 'students' has most fields, and 'users' provides the email.
      const formattedStudents = data?.map(s => ({
        id: s.id,
        name: s.name,
        email: s.users?.email || s.email || 'N/A', // Prioritize email from users table if joined, fallback to student table if it has email
        classId: s.class_id,
        profilePictureUrl: s.profile_picture_url,
        dateOfBirth: s.date_of_birth,
        guardianName: s.guardian_name,
        contactNumber: s.contact_number,
        address: s.address,
        admissionDate: s.admission_date,
        userId: s.users?.id || '', // Assuming students.user_id links to users.id
        // Other fields like lastLogin, assignmentsSubmitted, etc. are not directly in students/users table
        // and would require more complex queries or separate tracking if needed on this page.
      })) || [];
      setStudents(formattedStudents);
    }
    setIsLoading(false);
  }


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

  const handleEditStudentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editStudentName.trim() || !editStudentEmail.trim()) {
      toast({ title: "Error", description: "Name and Email cannot be empty.", variant: "destructive" });
      return;
    }
    
    // Check if email is being changed and if the new email already exists for another user
    if (editStudentEmail.trim() !== editingStudent.email) {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', editStudentEmail.trim())
        .neq('id', editingStudent.userId) // Exclude the current student's user record
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows, which is good
        toast({ title: "Error", description: "Database error checking email.", variant: "destructive" });
        return;
      }
      if (existingUser) {
        toast({ title: "Error", description: "Another user with this email already exists.", variant: "destructive" });
        return;
      }
    }

    // Update 'students' table (or your student profiles table)
    const { error: studentUpdateError } = await supabase
      .from('students') // Assuming 'students' table for profile info
      .update({ name: editStudentName.trim(), email: editStudentEmail.trim() }) // Update email here if it's on student profile table
      .eq('id', editingStudent.id);

    if (studentUpdateError) {
      toast({ title: "Error", description: `Failed to update student profile: ${studentUpdateError.message}`, variant: "destructive" });
      return;
    }

    // Update 'users' table (for login email and name)
    // This assumes editingStudent.userId holds the ID from the 'users' table.
    if (editingStudent.userId) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ name: editStudentName.trim(), email: editStudentEmail.trim() })
        .eq('id', editingStudent.userId); 
      
      if (userUpdateError) {
        toast({ title: "Warning", description: `Student profile updated, but failed to update user login details: ${userUpdateError.message}`, variant: "default" });
        // Decide on rollback or proceed with partial success. For now, we proceed.
      }
    } else {
        toast({ title: "Warning", description: "Student profile updated, but no linked user account found to update login details.", variant: "default" });
    }
    
    // TODO: Update admission record if necessary (if email is a key there)
    // This depends on how admission records are linked and if they store email redundantly.

    toast({ title: "Student Updated", description: `${editStudentName.trim()}'s details updated.` });
    setIsEditDialogOpen(false);
    setEditingStudent(null);
    fetchStudents(); // Re-fetch to show updated data
  };
  
  const handleDeleteStudent = async (student: Student) => { 
    if (confirm(`Are you sure you want to delete ${student.name}? This will also remove their login access and admission record if any.`)) {
      
      // 1. Delete from 'students' (profile) table
      const { error: studentDeleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (studentDeleteError) {
        toast({ title: "Error", description: `Failed to delete student profile: ${studentDeleteError.message}`, variant: "destructive" });
        return;
      }

      // 2. Delete from 'users' (login) table if userId exists
      if (student.userId) {
        const { error: userDeleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', student.userId);
        if (userDeleteError) {
          toast({ title: "Warning", description: `Student profile deleted, but failed to delete user login: ${userDeleteError.message}`, variant: "default" });
        }
      }
      
      // 3. TODO: Delete from 'admission_records' table.
      // This needs logic to find the admission record, likely by student.email or a student_id FK.
      // Example:
      // const { error: admissionDeleteError } = await supabase
      //   .from('admission_records') // Assuming table name
      //   .delete()
      //   .eq('student_id', student.id); // Or .eq('email', student.email)
      // if (admissionDeleteError) { /* ... handle ... */ }


      toast({
        title: "Student Deleted",
        description: `${student.name} has been removed.`,
        variant: "destructive"
      });
      fetchStudents(); // Re-fetch
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
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading students...</p>
              ) : (
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
                            <AvatarImage src={student.profilePictureUrl || `https://placehold.co/40x40.png?text=${student.name.substring(0,2).toUpperCase()}`} alt={student.name} data-ai-hint="person portrait" />
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
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteStudent(student)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isLoading && filteredStudents.length === 0 && (
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
              <p className="mt-2 text-sm">This section could include things like login history, assignment submission rates, forum participation, etc., by querying relevant Supabase tables.</p>
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
                <Input id="editStudentName" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentEmail" className="text-right">Email</Label>
                <Input id="editStudentEmail" type="email" value={editStudentEmail} onChange={(e) => setEditStudentEmail(e.target.value)} className="col-span-3" required />
              </div>
              {/* Add other editable fields here if needed, e.g., classId, profilePictureUrl etc.
                  Make sure to update the Supabase queries in handleEditStudentSubmit accordingly. */}
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
