
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import type { Course, UserRole, SchoolEntry, SubscriptionPlan } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { createCourseAction, updateCourseAction, deleteCourseAction, assignCourseToSchoolsAction } from '@/app/(app)/admin/lms/courses/actions';
import { PlusCircle, Edit2, Trash2, Save, Library, Settings, KeyRound, Loader2, Upload, Percent, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsRight, Send } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';


const ITEMS_PER_PAGE = 10;

export default function SuperAdminManageCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);

  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseToAssign, setCourseToAssign] = useState<Course | null>(null);
  const [allSchools, setAllSchools] = useState<SchoolEntry[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [featureImageFile, setFeatureImageFile] = useState<File | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('one_time');
  const [price, setPrice] = useState<number | ''>('');
  const [maxUsers, setMaxUsers] = useState<number | ''>('');
  
  const fetchCourses = async () => {
    setIsLoading(true);
    // Superadmin sees all courses. Join with schools to get school name.
    const { data, error } = await supabase
      .from('lms_courses')
      .select('*, school:school_id(name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: `Failed to fetch courses: ${error.message}`, variant: "destructive" });
      setCourses([]);
    } else {
      setCourses(data || []);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    fetchCourses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paginatedCourses = courses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(courses.length / ITEMS_PER_PAGE);

  const resetCourseForm = () => {
    setTitle('');
    setDescription('');
    setFeatureImageFile(null);
    setSubscriptionPlan('free');
    setPrice('');
    setMaxUsers('');
    setEditingCourse(null);
  };

  const handleOpenCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setTitle(course.title);
      setDescription(course.description || '');
      setFeatureImageFile(null);
      setSubscriptionPlan(course.subscription_plan || 'free');
      setPrice(course.price ?? '');
      setMaxUsers(course.max_users_allowed ?? '');
    } else {
      resetCourseForm();
    }
    setIsCourseDialogOpen(true);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File too large", description: "Feature image should be less than 2MB.", variant: "destructive" });
      return;
    }
    setFeatureImageFile(file);
  };

  const handleCourseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentAdminUserId) {
      toast({ title: "Error", description: "Course Title and admin context are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const isPaid = subscriptionPlan !== 'free';

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('school_id', ''); // Global course
    formData.append('created_by_user_id', currentAdminUserId);
    formData.append('is_paid', String(isPaid));
    formData.append('price', String(isPaid ? price || 0 : 0));
    formData.append('subscription_plan', subscriptionPlan);
    formData.append('max_users_allowed', String(maxUsers || 0));

    if(featureImageFile) {
        formData.append('feature_image_url', featureImageFile);
    }
    
    let result;
    if (editingCourse) {
      result = await updateCourseAction(editingCourse.id, formData);
    } else {
      result = await createCourseAction(formData);
    }

    if (result.ok) {
      toast({ title: editingCourse ? "Course Updated" : "Course Added", description: result.message });
      resetCourseForm();
      setIsCourseDialogOpen(false);
      await fetchCourses(); // Refetch courses
      if (!editingCourse && result.course) {
        handleOpenAssignDialog(result.course);
      }
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteCourse = async (courseId: string) => {
    const courseToDelete = courses.find(c => c.id === courseId);
    if (!courseToDelete) return;
    if (confirm(`Are you sure you want to delete the course "${courseToDelete.title}"? This will also remove related resources, school assignments, and enrollments.`)) {
      setIsSubmitting(true);
      const result = await deleteCourseAction(courseId);
      toast({ title: result.ok ? "Course Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
      if (result.ok) {
        fetchCourses();
      }
      setIsSubmitting(false);
    }
  };

  const handleOpenAssignDialog = async (course: Course) => {
    setCourseToAssign(course);
    setIsSubmitting(true);
    const { data: schoolsData, error } = await supabase.from('schools').select('*').order('name');
    if (error) {
      toast({ title: "Error fetching schools", variant: "destructive" });
      setAllSchools([]);
    } else {
      setAllSchools(schoolsData || []);
    }
    const { data: existingAssignments } = await supabase.from('lms_course_school_availability').select('school_id').eq('course_id', course.id);
    setSelectedSchoolIds(existingAssignments?.map(a => a.school_id) || []);
    setIsSubmitting(false);
    setIsAssignDialogOpen(true);
  };

  const handleAssignToSchools = async () => {
    if (!courseToAssign) return;
    setIsSubmitting(true);
    const result = await assignCourseToSchoolsAction(courseToAssign.id, selectedSchoolIds);
    if (result.ok) {
        toast({ title: "Assignments Updated", description: result.message });
        setIsAssignDialogOpen(false);
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Global LMS Course Management"
        description="Create, edit, and manage global courses that can be assigned to schools."
        actions={
          <Button onClick={() => handleOpenCourseDialog()} disabled={isLoading || isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Global Course
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Library className="mr-2 h-5 w-5" />Course Library</CardTitle>
          <CardDescription>A list of all courses in the system. Use 'Assign' to manage school access.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : paginatedCourses.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No courses created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.map((course: any) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>{course.school_id ? course.school.name : 'Global'}</TableCell>
                    <TableCell>{course.subscription_plan?.replace('_', ' ') || 'N/A'}</TableCell>
                    <TableCell>₹{course.price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{course.max_users_allowed || 'Unlimited'}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(course)} disabled={isSubmitting}>
                            <Send className="mr-2 h-4 w-4" /> Assign
                        </Button>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSubmitting}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem asChild>
                                <Link href={`/admin/lms/courses/${course.id}/content`}>
                                   <Settings className="mr-2 h-4 w-4" /> Manage Content
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleOpenCourseDialog(course)}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator/>
                              <DropdownMenuItem onSelect={() => handleDeleteCourse(course.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Course
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Assign Course to Schools</DialogTitle>
                <DialogDescription>Select which schools should have access to "{courseToAssign?.title}".</DialogDescription>
            </DialogHeader>
            <div className="py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                    {allSchools.map(school => (
                        <div key={school.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`school-${school.id}`}
                                checked={selectedSchoolIds.includes(school.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedSchoolIds(prev => 
                                        checked ? [...prev, school.id] : prev.filter(id => id !== school.id)
                                    )
                                }}
                            />
                            <Label htmlFor={`school-${school.id}`} className="font-normal">{school.name}</Label>
                        </div>
                    ))}
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleAssignToSchools} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Save Assignments
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit' : 'Add New'} Global Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCourseSubmit}>
            <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Introduction to Programming" required disabled={isSubmitting} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the course" disabled={isSubmitting}/>
              </div>
              <div>
                <Label htmlFor="feature_image_url">Feature Image (Optional, &lt;2MB)</Label>
                <Input id="feature_image_url" type="file" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" disabled={isSubmitting}/>
              </div>
               <div>
                <Label>Subscription Plan</Label>
                <Select value={subscriptionPlan} onValueChange={(val) => setSubscriptionPlan(val as SubscriptionPlan)} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="one_time">One-Time Payment</SelectItem>
                    <SelectItem value="monthly">Monthly Subscription</SelectItem>
                    <SelectItem value="yearly">Yearly Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="price">Price (₹)</Label>
                    <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 499" step="0.01" min="0" required disabled={isSubmitting || subscriptionPlan === 'free'}/>
                  </div>
                  <div>
                    <Label htmlFor="maxUsers">Allowed Users</Label>
                    <Input id="maxUsers" type="number" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="Leave blank for unlimited" min="0" disabled={isSubmitting}/>
                  </div>
              </div>

            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                {editingCourse ? 'Save Changes' : 'Add Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
