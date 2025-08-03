
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Student, User, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { Edit2, Search, Users, Activity, Save, Loader2, FileDown, UserX, AlertTriangle, UserCheck, FileText, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; 
import { terminateStudentAction, reactivateStudentAction, updateStudentAction, checkFeeStatusAndGenerateTCAction } from './actions';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';

const ITEMS_PER_PAGE = 10;

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: userRec, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', adminUserId)
      .single();

  if (userError && userError.code !== 'PGRST116') {
      console.error("Error fetching user's school:", userError.message);
      return null;
  }

  if (userRec?.school_id) {
      return userRec.school_id;
  }
  
  // Fallback for older setups where admin might not have school_id on their user record
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
    
  if (schoolError && schoolError.code !== 'PGRST116') {
    console.error("Error fetching admin's school or admin not linked:", schoolError.message);
    return null;
  }
  return school?.id || null;
}

export default function ManageStudentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [allClassesInSchool, setAllClassesInSchool] = useState<ClassData[]>([]);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentRollNumber, setEditStudentRollNumber] = useState<string>('');
  const [editStudentClassId, setEditStudentClassId] = useState<string | undefined>(undefined);
  
  const [showTerminated, setShowTerminated] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);


  const fetchStudents = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    setPageError(null);
    let query = supabase
      .from('students')
      .select('id, name, email, class_id, profile_picture_url, user_id, school_id, status, roll_number')
      .eq('school_id', schoolId);

    if (showTerminated) {
      query = query.eq('status', 'Terminated');
    } else {
      query = query.or('status.eq.Active,status.is.null');
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error("Error fetching students:", JSON.stringify(error, null, 2));
      let description = `Database Error: ${error.message}.`;
      
      if (error.message.includes('column "status" does not exist')) {
          const detailedError = "Database schema is out of date. The 'status' column is missing from the 'students' table. Please run the required SQL migration to enable the terminate student feature.";
          setPageError(detailedError);
          toast({ title: "Database Schema Error", description: detailedError, variant: "destructive", duration: 15000 });
      } else {
           toast({ title: "Error Fetching Students", description, variant: "destructive", duration: 10000 });
           setPageError(description);
      }
      setStudents([]);
    } else {
      setStudents(data || []);
    }
    setIsLoading(false);
  }, [showTerminated, toast]);


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
  }, [toast, fetchStudents]);
  
   useEffect(() => {
    if (currentSchoolId) {
      fetchStudents(currentSchoolId);
    }
  }, [currentSchoolId, showTerminated, fetchStudents]);


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

  const getClassDisplayName = (classId?: string | null): string => {
    if (!classId) return 'N/A';
    const cls = allClassesInSchool.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };

  const filteredStudents = useMemo(() => students.filter(student =>
    (student.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (student.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [students, searchTerm]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStudents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStudents, currentPage]);
  const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);

  
  const handleOpenEditDialog = (student: Student) => { 
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentEmail(student.email);
    setEditStudentRollNumber(student.roll_number || '');
    setEditStudentClassId(student.class_id || undefined);
    setIsEditDialogOpen(true);
  };

  const handleEditStudentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.user_id || !editStudentName.trim() || !editStudentEmail.trim() || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, and necessary context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const result = await updateStudentAction({
        studentId: editingStudent.id,
        userId: editingStudent.user_id,
        schoolId: currentSchoolId,
        name: editStudentName.trim(),
        email: editStudentEmail.trim(),
        roll_number: editStudentRollNumber.trim() || null,
        class_id: editStudentClassId === 'unassign' ? null : (editStudentClassId || null),
    });

    if (result.ok) {
      toast({ title: "Student Updated", description: result.message });
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      if(currentSchoolId) fetchStudents(currentSchoolId); 
    } else {
       toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    
    setIsSubmitting(false);
  };
  
  const handleTerminateStudent = async (student: Student) => { 
    if (!currentSchoolId || !student.user_id) {
        toast({ title: "Error", description: "Cannot terminate student without a valid user ID.", variant: "destructive" });
        return;
    };
    
    setIsSubmitting(true);
    const result = await terminateStudentAction(student.id, student.user_id, currentSchoolId);
    if (result.ok) {
      toast({ title: "Student Terminated", description: result.message });
      if(currentSchoolId) fetchStudents(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleReactivateStudent = async (student: Student) => { 
    if (!currentSchoolId || !student.user_id) {
        toast({ title: "Error", description: "Cannot reactivate student without a valid user ID.", variant: "destructive" });
        return;
    };
    
    setIsSubmitting(true);
    const result = await reactivateStudentAction(student.id, student.user_id, currentSchoolId);
    if (result.ok) {
      toast({ title: "Student Reactivated", description: result.message });
      if(currentSchoolId) fetchStudents(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };


  const handleDownloadCsv = () => {
    if (filteredStudents.length === 0) {
        toast({ title: "No Data", description: "There are no students to download for the current filter.", variant: "destructive"});
        return;
    }
    const headers = ["Name", "Roll Number", "Email", "Class", "Status", "Student UUID"];
    const csvRows = [
        headers.join(','),
        ...filteredStudents.map(student => {
            const className = getClassDisplayName(student.class_id);
            const row = [
                `"${(student.name || '').replace(/"/g, '""')}"`,
                `"${student.roll_number || 'N/A'}"`,
                `"${(student.email || 'N/A').replace(/"/g, '""')}"`,
                `"${className.replace(/"/g, '""')}"`,
                `"${student.status || 'Active'}"`,
                `"${student.id}"`,
            ];
            return row.join(',');
        })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleGenerateTC = async (student: Student) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await checkFeeStatusAndGenerateTCAction(student.id, currentSchoolId);
    setIsSubmitting(false);
    
    if (result.ok) {
      router.push(`/admin/transfer-certificate?studentId=${student.id}`);
    } else {
      toast({
        title: "Cannot Issue Certificate",
        description: result.message,
        variant: "destructive",
        duration: 10000,
      });
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

        <Card>
          <CardHeader>
            <CardTitle>Student Roster</CardTitle>
            <CardDescription>View, search, and manage enrolled student profiles. New students are registered by teachers or admins.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex-grow flex items-center gap-2">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input 
                  placeholder="Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                  disabled={isLoading}
                  />
              </div>
               <div className="flex items-center space-x-2">
                  <Checkbox id="showTerminated" checked={showTerminated} onCheckedChange={(checked) => setShowTerminated(!!checked)} />
                  <Label htmlFor="showTerminated">Show Terminated Students</Label>
              </div>
              <Button onClick={handleDownloadCsv} disabled={isLoading || filteredStudents.length === 0} className="ml-auto">
                  <FileDown className="mr-2 h-4 w-4"/>
                  Download Report
              </Button>
            </div>
            {isLoading ? (
               <p className="text-center text-muted-foreground py-4">Loading students...</p>
            ) : pageError ? (
              <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Student Data</AlertTitle>
                <AlertDescription>
                  <p>{pageError}</p>
                  <p className="mt-2 text-xs">This page cannot function correctly until the database schema is updated. Please refer to the instructions provided.</p>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {paginatedStudents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avatar</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Class / Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStudents.map((student) => (
                        <TableRow key={student.id} className={student.status !== 'Active' && student.status ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Avatar>
                              <AvatarImage src={student.profile_picture_url || `https://placehold.co/40x40.png?text=${(student.name || 'S').substring(0,2).toUpperCase()}`} alt={student.name || 'Student'} data-ai-hint="person portrait" />
                              <AvatarFallback>{(student.name || 'S').substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>
                              <span className="font-mono text-xs">{student.roll_number || 'N/A'}</span>
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>
                              {student.status && student.status !== 'Active' ? 
                                  <Badge variant="destructive">{student.status}</Badge> 
                                  : getClassDisplayName(student.class_id)
                              }
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {student.status === 'Active' || !student.status ? (
                                    <>
                                      <DropdownMenuItem onSelect={() => handleOpenEditDialog(student as Student)}><Edit2 className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => handleGenerateTC(student as Student)}><FileText className="mr-2 h-4 w-4"/>Generate TC</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><UserX className="mr-2 h-4 w-4"/>Terminate</DropdownMenuItem>
                                      </AlertDialogTrigger>
                                    </>
                                  ) : (
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}><UserCheck className="mr-2 h-4 w-4"/>Reactivate</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {student.status === 'Active' || !student.status ? (
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Terminate {student.name}?</AlertDialogTitle><AlertDialogDescription>This will mark the student as 'Terminated', unassign them from their class, and deactivate their login. This action is reversible.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleTerminateStudent(student as Student)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Terminate</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                              ) : (
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Reactivate {student.name}?</AlertDialogTitle><AlertDialogDescription>This will mark the student's status as 'Active' and re-enable their login. They will not be automatically re-assigned to a class.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleReactivateStudent(student as Student)} disabled={isSubmitting} className="bg-green-600 text-white hover:bg-green-700">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Reactivate</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                              )}
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    {searchTerm ? "No students match your search." : (showTerminated ? "No terminated students found." : "No active students found for this school.")}
                  </p>
                )}
              </>
            )}
          </CardContent>
           {totalPages > 1 && (
              <CardFooter className="flex justify-end items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                      Next <ChevronRight className="h-4 w-4" />
                  </Button>
              </CardFooter>
          )}
        </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Student: {editingStudent?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditStudentSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentName" className="text-right">Name</Label>
                <Input id="editStudentName" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="col-span-3" required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentEmail" className="text-right">Email</Label>
                <Input id="editStudentEmail" type="email" value={editStudentEmail} onChange={(e) => setEditStudentEmail(e.target.value)} className="col-span-3" required disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentRollNumber" className="text-right">Roll Number</Label>
                <Input id="editStudentRollNumber" value={editStudentRollNumber || ''} onChange={(e) => setEditStudentRollNumber(e.target.value)} className="col-span-3" placeholder="Optional" disabled={isSubmitting} />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editStudentClassId" className="text-right">Assign Class</Label>
                 <Select value={editStudentClassId} onValueChange={(value) => setEditStudentClassId(value === 'unassign' ? undefined : value)} disabled={isSubmitting}>
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
