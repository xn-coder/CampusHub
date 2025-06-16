
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Edit2, Trash2, Save, Library, Users, Settings, UserPlus, KeyRound, Copy, Loader2 } from 'lucide-react';
import type { Course, CourseActivationCode, User } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { createCourseAction, updateCourseAction, deleteCourseAction, generateActivationCodesAction } from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export default function ManageCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null); // For school-specific courses

  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForCodeGeneration, setCourseForCodeGeneration] = useState<Course | null>(null);
  const [generatedCodesForDisplay, setGeneratedCodesForDisplay] = useState<string[]>([]);
  const [numCodesToGenerate, setNumCodesToGenerate] = useState<number>(1);
  const [codeExpiresInDays, setCodeExpiresInDays] = useState<number>(365);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | ''>('');

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId); // May be null if admin is not school-specific (e.g. superadmin creating global courses)
        fetchCourses(schoolId); // Pass schoolId to fetch relevant courses
      });
    } else {
        toast({title: "Error", description: "Admin user not identified.", variant: "destructive"});
        setIsLoading(false);
    }
  }, [toast]);

  async function fetchCourses(schoolId: string | null) {
    setIsLoading(true);
    let query = supabase.from('lms_courses').select('*').order('created_at', { ascending: false });
    // If schoolId is available, filter by it OR allow courses with NULL school_id (global courses)
    // This logic depends on how you want to scope courses (global vs school-specific)
    // For now, let's assume an admin sees courses they created or that are for their school, or global ones
    // This might require more complex filtering based on created_by_user_id or school_id
    if (schoolId && currentAdminUserId) { // A school admin might only see their school's courses or global ones
        query = query.or(`school_id.eq.${schoolId},school_id.is.null,created_by_user_id.eq.${currentAdminUserId}`);
    } else if (currentAdminUserId) { // A superadmin might see all courses, or only global ones they made
        query = query.or(`school_id.is.null,created_by_user_id.eq.${currentAdminUserId}`);
    }


    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: "Failed to fetch courses.", variant: "destructive" });
      setCourses([]);
    } else {
      setCourses(data || []);
    }
    setIsLoading(false);
  }


  const resetCourseForm = () => {
    setTitle('');
    setDescription('');
    setIsPaid(false);
    setPrice('');
    setEditingCourse(null);
  };

  const handleOpenCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setTitle(course.title);
      setDescription(course.description || '');
      setIsPaid(course.is_paid);
      setPrice(course.price ?? '');
    } else {
      resetCourseForm();
    }
    setIsCourseDialogOpen(true);
  };

  const handleCourseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentAdminUserId) {
      toast({ title: "Error", description: "Course Title and admin context are required.", variant: "destructive" });
      return;
    }
    if (isPaid && (price === '' || Number(price) <= 0)) {
      toast({ title: "Error", description: "Price is required for paid courses and must be greater than 0.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const courseData = {
      title: title.trim(),
      description: description.trim() || undefined,
      is_paid: isPaid,
      price: isPaid ? Number(price) : undefined,
      school_id: currentSchoolId || undefined, // Assign to current admin's school if available
    };

    let result;
    if (editingCourse) {
      result = await updateCourseAction(editingCourse.id, courseData);
    } else {
      result = await createCourseAction(courseData);
    }

    if (result.ok) {
      toast({ title: editingCourse ? "Course Updated" : "Course Added", description: result.message });
      resetCourseForm();
      setIsCourseDialogOpen(false);
      fetchCourses(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteCourse = async (courseId: string) => {
    const courseToDelete = courses.find(c => c.id === courseId);
    if (!courseToDelete) return;
    if (confirm(`Are you sure you want to delete the course "${courseToDelete.title}"? This will also remove related resources, activation codes, and enrollments.`)) {
      setIsSubmitting(true);
      const result = await deleteCourseAction(courseId);
      toast({ title: result.ok ? "Course Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok) {
        fetchCourses(currentSchoolId);
      }
      setIsSubmitting(false);
    }
  };

  const handleOpenCodeGenerationDialog = (course: Course) => {
    if (!course.is_paid) {
      toast({ title: "Not a Paid Course", description: "Activation codes can only be generated for paid courses.", variant: "destructive" });
      return;
    }
    setCourseForCodeGeneration(course);
    setNumCodesToGenerate(1);
    setCodeExpiresInDays(365);
    setGeneratedCodesForDisplay([]);
    setIsCodeDialogOpen(true);
  };

  const handleGenerateCodes = async () => {
    if (!courseForCodeGeneration || numCodesToGenerate <= 0 || !currentAdminUserId) {
      toast({ title: "Error", description: "Course, valid number of codes, and admin context are required.", variant: "destructive"});
      return;
    }
    if (codeExpiresInDays <=0) {
      toast({ title: "Error", description: "Expiration days must be a positive number.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);

    const result = await generateActivationCodesAction({
      course_id: courseForCodeGeneration.id,
      num_codes: numCodesToGenerate,
      expires_in_days: codeExpiresInDays,
      school_id: courseForCodeGeneration.school_id || undefined, // Pass school_id if course is school-specific
    });

    if (result.ok && result.generatedCodes) {
      setGeneratedCodesForDisplay(result.generatedCodes);
      toast({ title: `${numCodesToGenerate} Activation Code(s) Generated`, description: result.message});
    } else {
      toast({ title: "Error Generating Codes", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
    // Don't close dialog, let admin see codes
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => toast({ title: "Code Copied!", description: code }))
      .catch(() => toast({ title: "Copy Failed", variant: "destructive"}));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="LMS Course Management"
        description="Create, edit, and manage online courses and their activation codes."
        actions={
          <Button onClick={() => handleOpenCourseDialog()} disabled={isLoading || isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Course
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Library className="mr-2 h-5 w-5" />Available Courses</CardTitle>
          <CardDescription>List of all courses offered in the LMS.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : courses.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No courses created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{course.description}</TableCell>
                    <TableCell>{course.is_paid ? 'Paid' : 'Unpaid'}</TableCell>
                    <TableCell>{course.is_paid && course.price ? `$${course.price.toFixed(2)}` : 'N/A'}</TableCell>
                    <TableCell>{course.school_id ? 'School-Specific' : 'Global'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
                        <Link href={`/admin/lms/courses/${course.id}/content`}>
                           <Settings className="mr-1 h-3 w-3" /> Content
                        </Link>
                      </Button>
                       <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
                        <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                          <UserPlus className="mr-1 h-3 w-3" /> Enroll
                        </Link>
                      </Button>
                      {course.is_paid && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenCodeGenerationDialog(course)} disabled={isSubmitting}>
                          <KeyRound className="mr-1 h-3 w-3" /> Codes
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => handleOpenCourseDialog(course)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteCourse(course.id)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit' : 'Add New'} Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCourseSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Introduction to Programming" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the course" disabled={isSubmitting}/>
              </div>
              <div>
                <Label>Course Type</Label>
                <RadioGroup value={isPaid ? "paid" : "unpaid"} onValueChange={(val) => setIsPaid(val === "paid")} className="flex space-x-4 mt-1" disabled={isSubmitting}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unpaid" id="unpaid" />
                    <Label htmlFor="unpaid">Unpaid (Free)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paid" id="paid" />
                    <Label htmlFor="paid">Paid</Label>
                  </div>
                </RadioGroup>
              </div>
              {isPaid && (
                <div>
                  <Label htmlFor="price">Price ($)</Label>
                  <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 49.99" step="0.01" min="0.01" required={isPaid} disabled={isSubmitting}/>
                </div>
              )}
              {/* Add school_id selection if superadmin is creating and it can be school-specific */}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingCourse ? 'Save Changes' : 'Add Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCodeDialogOpen} onOpenChange={setIsCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Activation Codes</DialogTitle>
            <CardDescription>For course: {courseForCodeGeneration?.title}</CardDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="numCodesToGenerate">Number of Codes to Generate</Label>
              <Input 
                id="numCodesToGenerate" 
                type="number" 
                min="1" 
                max="100"
                value={numCodesToGenerate} 
                onChange={(e) => setNumCodesToGenerate(parseInt(e.target.value))} 
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="codeExpiresInDays">Expires in (days)</Label>
              <Input 
                id="codeExpiresInDays" 
                type="number" 
                min="1"
                value={codeExpiresInDays} 
                onChange={(e) => setCodeExpiresInDays(parseInt(e.target.value))} 
                disabled={isSubmitting}
              />
            </div>
            <Button onClick={handleGenerateCodes} disabled={isSubmitting}>
             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <KeyRound className="mr-2 h-4 w-4"/>} Generate Codes
            </Button>
            {generatedCodesForDisplay.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                <h4 className="font-medium">Generated Codes:</h4>
                {generatedCodesForDisplay.map(code => (
                  <div key={code} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                    <span className="text-sm font-mono">{code}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleCopyCode(code)} title="Copy code">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    