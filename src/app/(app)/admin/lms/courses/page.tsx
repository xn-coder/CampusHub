

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CourseWithEnrollmentStatus as Course, UserRole, ClassData, SchoolDetails, SubscriptionPlan } from '@/types';
import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import Image from 'next/image';
import { 
    getAdminLmsPageData,
    assignCourseToSchoolAudienceAction, 
    enrollSchoolInCourseAction,
    updateCourseAction,
} from './actions';
import { Library, Settings, UserPlus, Loader2, Eye, Search, ChevronLeft, ChevronRight, Lock, Unlock, CreditCard, Edit2, Trash2, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox"
import { Save } from "lucide-react";
import { formatDistanceToNow, addDays, addMonths, addYears } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const ITEMS_PER_PAGE = 9;

export default function SchoolLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<SchoolDetails | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isEditCourseDialogOpen, setIsEditCourseDialogOpen] = useState(false);
  const [courseToAction, setCourseToAction] = useState<Course | null>(null);
  const [assignTarget, setAssignTarget] = useState<'all_students' | 'all_teachers' | 'class'>('all_students');
  const [assignTargetClassId, setAssignTargetClassId] = useState<string>('');
  
  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFeatureImageFile, setEditFeatureImageFile] = useState<File | null>(null);
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editDiscount, setEditDiscount] = useState<number | ''>('');


  const fetchPageData = useCallback(async (adminUserId: string) => {
    setIsLoading(true);
    const result = await getAdminLmsPageData(adminUserId);
    if (result.ok) {
        setCourses(result.courses || []);
        setClasses(result.classes || []);
        setCurrentSchool(result.school || null);
    } else {
        toast({ title: "Error", description: result.message || "Failed to load page data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      setCurrentUserId(adminUserId);
      fetchPageData(adminUserId);
    }
  }, [toast, fetchPageData]);
  
  const handleOpenAssignDialog = (course: Course) => {
    setCourseToAction(course);
    setAssignTarget('all_students');
    setAssignTargetClassId('');
    setIsAssignDialogOpen(true);
  };
  
  const handleOpenEditDialog = (course: Course) => {
      setCourseToAction(course);
      setEditTitle(course.title);
      setEditDescription(course.description || '');
      setEditIsPaid(course.is_paid);
      setEditPrice(course.price || '');
      setEditDiscount(course.discount_percentage || '');
      setEditFeatureImageFile(null);
      setIsEditCourseDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File is too large", description: "Image must be smaller than 2MB.", variant: "destructive" });
      return;
    }
    setEditFeatureImageFile(file);
  };

  const handleEditCourseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!courseToAction || !currentSchool || !currentUserId) return;
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('title', editTitle);
    formData.append('description', editDescription);
    formData.append('is_paid', String(editIsPaid));
    formData.append('price', String(editPrice || '0'));
    formData.append('discount_percentage', String(editDiscount || '0'));
    formData.append('school_id', currentSchool.id);
    formData.append('created_by_user_id', currentUserId);

    if (editFeatureImageFile) {
        formData.append('feature_image_url', editFeatureImageFile);
    }
    
    const result = await updateCourseAction(courseToAction.id, formData);

    if (result.ok) {
        toast({ title: "Course Updated", description: "Course details have been saved."});
        setIsEditCourseDialogOpen(false);
        if(currentUserId) fetchPageData(currentUserId);
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive"});
    }
    
    setIsSubmitting(false);
  };


  const handleAssignCourse = async () => {
    if (!courseToAction || !currentSchool || !assignTarget) return;
    if (assignTarget === 'class' && !assignTargetClassId) {
      toast({ title: "Error", description: "Please select a class.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await assignCourseToSchoolAudienceAction({
      courseId: courseToAction.id,
      schoolId: currentSchool.id,
      targetAudience: assignTarget,
      classId: assignTarget === 'class' ? assignTargetClassId : undefined
    });

    if (result.ok) {
      toast({ title: "Course Assigned", description: result.message });
      setIsAssignDialogOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
  }
  
  const handleEnrollFreeCourse = async (courseId: string) => {
      if (!currentSchool || !currentUserId) {
        toast({ title: "Error", description: "School context or user is missing.", variant: "destructive" });
        return;
      }
      setIsSubmitting(true);
      
      const result = await enrollSchoolInCourseAction(courseId, currentSchool.id);

      if(result.ok) {
        toast({title: "Success!", description: `Your school now has access to this course. You can assign it to users.`});
        await fetchPageData(currentUserId);
      } else {
        toast({ title: "Enrollment Failed", description: result.message, variant: "destructive"});
      }

      setIsSubmitting(false);
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  
  const getSubscriptionStatus = (course: Course) => {
    if (!course.isEnrolled) return null;
    if (!course.is_paid) return <Badge className="bg-green-600 hover:bg-green-700 flex items-center"><Unlock className="mr-1 h-3 w-3"/> Free</Badge>;
    if (!course.subscription_plan || !course.subscription_date) return <Badge variant="destructive">Error</Badge>;

    const subscriptionDate = new Date(course.subscription_date);
    let expiryDate;
    
    switch (course.subscription_plan) {
      case 'monthly':
        expiryDate = addMonths(subscriptionDate, 1);
        break;
      case 'yearly':
        expiryDate = addYears(subscriptionDate, 1);
        break;
      case 'one_time':
        return <Badge className="flex items-center">Lifetime Access</Badge>;
      default:
        return <Badge className="flex items-center">Enrolled</Badge>;
    }

    const now = new Date();
    if (now > expiryDate) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    const remainingTime = formatDistanceToNow(expiryDate, { addSuffix: true });

    return (
      <Badge className="flex items-center" variant="secondary">
        <CalendarDays className="mr-1 h-3 w-3" />
        Expires {remainingTime}
      </Badge>
    );
  };


  return (
    <>
    <div className="flex flex-col gap-6">
      <PageHeader
        title="LMS Courses for Your School"
        description="Manage courses assigned to your school and enroll your users."
      />
      <Card>
        <CardHeader>
          <CardTitle>Assigned Courses</CardTitle>
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardDescription>Courses available for enrollment at your school.</CardDescription>
            <div className="relative w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search assigned courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full md:w-64"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 flex items-center justify-center gap-2"><Loader2 className="h-6 w-6 animate-spin"/>Loading courses...</div>
          ) : paginatedCourses.length === 0 ? (
            <div className="text-center py-10">
                <Library className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No Courses Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm ? 'No courses match your search.' : 'No courses have been assigned to your school yet.'}
                </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCourses.map((course) => (
                    <Card key={course.id} className="flex flex-col overflow-hidden group">
                        <div className="relative aspect-video">
                            <Image 
                                src={course.feature_image_url || `https://placehold.co/600x400.png`}
                                alt={course.title}
                                fill
                                className="object-cover"
                                data-ai-hint="course cover"
                            />
                             <div className="absolute top-2 right-2 flex gap-1">
                                {getSubscriptionStatus(course)}
                            </div>
                        </div>
                        <CardHeader>
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <CardDescription className="line-clamp-3">{course.description || "No description available."}</CardDescription>
                        </CardContent>
                        <CardFooter className="flex-col sm:flex-row gap-2">
                           {course.isEnrolled ? (
                             <>
                              <Button asChild className="w-full" variant="secondary">
                                <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                                    <UserPlus className="mr-2 h-4 w-4"/> User List
                                </Link>
                              </Button>
                              <div className="flex w-full gap-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button className="flex-1" variant="outline">Assign Course</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirm Course Assignment</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will enroll all selected users into the course "{course.title}". 
                                        Already enrolled users will be skipped. Are you sure you want to proceed?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleOpenAssignDialog(course)}>Proceed</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button size="icon" variant="ghost" onClick={() => handleOpenEditDialog(course)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                             </>
                           ) : (
                             <>
                               <Button asChild variant="outline" className="w-full">
                                <Link href={`/lms/courses/${course.id}?preview=true`}>
                                  <Eye className="mr-2 h-4 w-4"/> Preview
                                </Link>
                               </Button>
                               {course.is_paid ? (
                                  <Button asChild className="w-full">
                                      <Link href={`/student/lms/activate?courseId=${course.id}`}>
                                        <CreditCard className="mr-2 h-4 w-4"/> Subscribe
                                      </Link>
                                  </Button>
                               ) : (
                                  <Button onClick={() => handleEnrollFreeCourse(course.id)} className="w-full" disabled={isSubmitting}>
                                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4"/>}
                                      Enroll
                                  </Button>
                               )}
                             </>
                           )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
          )}
        </CardContent>
         {totalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2 border-t pt-4">
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
    </div>
    
    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Assign Course: {courseToAction?.title}</DialogTitle>
                <DialogDescription>Enroll a specific group of users from your school into this course.</DialogDescription>
            </DialogHeader>
             <div className="py-4 space-y-4">
                <div>
                  <Label>Assign To</Label>
                  <Select value={assignTarget} onValueChange={(val) => setAssignTarget(val as any)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_students">All Students</SelectItem>
                      <SelectItem value="all_teachers">All Teachers</SelectItem>
                      <SelectItem value="class">A Specific Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {assignTarget === 'class' && (
                  <div>
                    <Label>Select Class</Label>
                    <Select value={assignTargetClassId} onValueChange={setAssignTargetClassId}>
                      <SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleAssignCourse} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Confirm Assignment
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isEditCourseDialogOpen} onOpenChange={setIsEditCourseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit Course Details: {courseToAction?.title}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditCourseSubmit}>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                    <div><Label htmlFor="edit-title">Course Title</Label><Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required disabled={isSubmitting}/></div>
                    <div><Label htmlFor="edit-description">Description</Label><Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} disabled={isSubmitting}/></div>
                    <div><Label htmlFor="edit-feature-image">Feature Image (Optional)</Label><Input id="edit-feature-image" type="file" onChange={handleFileChange} accept="image/*" disabled={isSubmitting}/></div>
                    <div className="flex items-center space-x-2"><Checkbox id="edit-is-paid" checked={editIsPaid} onCheckedChange={(c) => setEditIsPaid(!!c)}/><Label htmlFor="edit-is-paid">This is a paid course</Label></div>
                    {editIsPaid && (
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="edit-price">Price (₹)</Label><Input id="edit-price" type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} disabled={isSubmitting}/></div>
                            <div><Label htmlFor="edit-discount">Discount (%)</Label><Input id="edit-discount" type="number" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value === '' ? '' : parseFloat(e.target.value))} disabled={isSubmitting}/></div>
                        </div>
                    )}
                </div>
                <DialogFooter className="mt-4">
                    <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    </>
  );
}

