

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
    createCoursePaymentOrderAction,
    verifyCoursePaymentAndEnrollAction
} from './actions';
import { Library, Settings, UserPlus, Loader2, Eye, Search, ChevronLeft, ChevronRight, Lock, Unlock, CreditCard, Edit2, Trash2, CalendarDays, ShoppingCart, CheckCheck, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import Script from 'next/script';


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
  const [courseToAction, setCourseToAction] = useState<Course | null>(null);
  const [assignTarget, setAssignTarget] = useState<'all_students' | 'all_teachers' | 'class'>('all_students');
  const [assignTargetClassId, setAssignTargetClassId] = useState<string>('');
  

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
      toast({ title: "Course Visibility Set", description: result.message });
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

  const handleSubscribeCourse = async (course: Course) => {
    if (!currentUserId) {
      toast({ title: "Error", description: "User ID not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await createCoursePaymentOrderAction(course.id, currentUserId);
    setIsSubmitting(false);

    if (!result.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        return;
    }
    if(result.isMock) {
        toast({ title: "Success!", description: result.message });
        if(currentUserId) fetchPageData(currentUserId);
        return;
    }
    if (result.order) {
        const rzpOptions = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: result.order.amount,
            currency: "INR",
            name: "CampusHub Course Subscription",
            description: `Payment for ${course.title}`,
            order_id: result.order.id,
            handler: async (response: any) => {
                const verifyResult = await verifyCoursePaymentAndEnrollAction(
                    response.razorpay_payment_id,
                    response.razorpay_order_id,
                    response.razorpay_signature
                );
                if (verifyResult.ok) {
                    toast({ title: "Success", description: verifyResult.message });
                    if(currentUserId) fetchPageData(currentUserId);
                } else {
                    toast({ title: "Payment Verification Failed", description: verifyResult.message, variant: "destructive" });
                }
            },
            prefill: {
                name: currentSchool?.admin_name,
                email: currentSchool?.admin_email,
                contact: currentSchool?.contact_phone,
            },
            theme: { color: "#3399cc" },
        };
        const rzp1 = new (window as any).Razorpay(rzpOptions);
        rzp1.open();
    }
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  
  const PriceDisplay = ({ course }: { course: Course }) => {
    if (!course.is_paid || !course.price) return <Badge variant="secondary">Free</Badge>;
    const discount = course.discount_percentage || 0;
    const finalPrice = course.price * (1 - discount / 100);
    return (
        <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">₹{finalPrice.toFixed(2)}</span>
            {discount > 0 && <span className="text-xs text-muted-foreground line-through">₹{course.price.toFixed(2)}</span>}
        </div>
    );
  };

  return (
    <>
    <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js" />
    <div className="flex flex-col gap-6">
      <PageHeader
        title="LMS Courses for Your School"
        description="Manage courses assigned to your school and make them visible to your users."
      />
      <Card>
        <CardHeader>
          <CardTitle>Assigned Courses</CardTitle>
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardDescription>Courses available for your school. Use 'Assign' to make them visible to students/teachers.</CardDescription>
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
                                {course.isEnrolled ? (
                                    <Badge className="bg-green-600 hover:bg-green-700 flex items-center"><Unlock className="mr-1 h-3 w-3"/> Enrolled</Badge>
                                ) : (
                                    <Badge variant="destructive" className="flex items-center"><Lock className="mr-1 h-3 w-3"/> Not Enrolled</Badge>
                                )}
                            </div>
                        </div>
                        <CardHeader className="flex-row justify-between items-start">
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                            <PriceDisplay course={course} />
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <CardDescription className="line-clamp-3">{course.description || "No description available."}</CardDescription>
                        </CardContent>
                        <CardFooter className="flex-col sm:flex-row gap-2">
                           {course.isEnrolled ? (
                                <>
                                    <Button asChild className="w-full" variant="secondary">
                                        <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                                            <UserPlus className="mr-2 h-4 w-4"/> User list
                                        </Link>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full" variant="outline">Assign course</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Assign Course Visibility</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will make the course "{course.title}" visible to the selected group of users. They will then be able to enroll themselves.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleOpenAssignDialog(course)}>Proceed</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            ) : (
                                <>
                                    <Button asChild className="w-full" variant="outline">
                                        <Link href={`/admin/lms/courses/${course.id}/content?preview=true`}>
                                            <Eye className="mr-2 h-4 w-4"/> Preview
                                        </Link>
                                    </Button>
                                    {course.is_paid ? (
                                        <Button className="w-full" onClick={() => handleSubscribeCourse(course)} disabled={isSubmitting}>
                                            <ShoppingCart className="mr-2 h-4 w-4" /> Subscribe
                                        </Button>
                                    ) : (
                                        <Button className="w-full" onClick={() => handleEnrollFreeCourse(course.id)} disabled={isSubmitting}>
                                            <CheckCheck className="mr-2 h-4 w-4" /> Enroll School (Free)
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
                <DialogDescription>Make this course visible to a specific group of users in your school. They will then be able to enroll themselves.</DialogDescription>
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
    </>
  );
}
