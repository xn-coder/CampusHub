

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
    unassignCourseFromSchoolAction,
    createSchoolSubscriptionOrderAction
} from './actions';
import { Library, Settings, UserPlus, Loader2, Eye, Search, ChevronLeft, ChevronRight, Lock, Unlock, CreditCard, Edit2, Trash2, CalendarDays, ShoppingCart, CheckCheck, MoreHorizontal, XCircle, Users as UsersIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { differenceInDays, parseISO, isPast } from 'date-fns';


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
  
  const [isSubscribeDialogOpen, setIsSubscribeDialogOpen] = useState(false);
  const [seatsToPurchase, setSeatsToPurchase] = useState<number>(1);


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
  
  const handleOpenSubscribeDialog = (course: Course) => {
    setCourseToAction(course);
    setSeatsToPurchase(1);
    setIsSubscribeDialogOpen(true);
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
      if(currentUserId) await fetchPageData(currentUserId); // Refetch data
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
  }
  
    const handleUnassignCourse = async (courseId: string) => {
    if (!currentSchool) return;
    if (confirm("Are you sure you want to unassign this course from your school? This will unenroll all users and remove it from your school's catalog.")) {
      setIsSubmitting(true);
      const result = await unassignCourseFromSchoolAction(courseId, currentSchool.id);
      if(result.ok) {
        toast({ title: "Course Unassigned", description: result.message });
        if (currentUserId) await fetchPageData(currentUserId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };


  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
  
  const SubscriptionBadge = ({ course }: { course: Course }) => {
    if (!course.is_paid || !course.subscription_end_date) {
        return null;
    }

    const endDate = parseISO(course.subscription_end_date);
    const now = new Date();
    const daysLeft = differenceInDays(endDate, now);
    
    let variant: "default" | "destructive" | "secondary" = "default";
    let text = `${daysLeft} days left`;

    if (isPast(endDate)) {
        variant = "destructive";
        text = "Expired";
    } else if (daysLeft <= 7) {
        variant = "destructive";
    } else if (daysLeft <= 30) {
        variant = "secondary";
    }

    return (
        <Badge variant={variant} className="absolute top-2 right-2">
            <CalendarDays className="mr-1.5 h-3 w-3" /> {text}
        </Badge>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course Catalog"
        description="Browse, enroll in, or subscribe to courses to make them available for assignment to your users."
      />
      <Card>
        <CardHeader>
           <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Available Courses</CardTitle>
              <CardDescription>Courses your school can enroll in. Enrolled courses can be assigned to users.</CardDescription>
            </div>
            <div className="relative w-full md:w-auto">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search courses..."
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
                    {searchTerm ? 'No courses match your search.' : 'There are no courses currently available for your school.'}
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
                            <SubscriptionBadge course={course} />
                        </div>
                        <CardHeader>
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <CardDescription className="line-clamp-3">{course.description || "No description available."}</CardDescription>
                        </CardContent>
                        <CardFooter className="flex-col sm:flex-row gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="w-full">
                                        <Settings className="mr-2 h-4 w-4" /> Manage Course
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/admin/lms/courses/${course.id}/content?preview=true`}>
                                            <Eye className="mr-2 h-4 w-4"/> Preview Content
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleOpenAssignDialog(course)}>
                                        <UserPlus className="mr-2 h-4 w-4"/> Assign To...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                                            <UsersIcon className="mr-2 h-4 w-4"/> Manage Enrollments
                                        </Link>
                                    </DropdownMenuItem>
                                    {course.is_paid && (
                                        <DropdownMenuItem onSelect={() => handleOpenSubscribeDialog(course)}>
                                            <CreditCard className="mr-2 h-4 w-4" /> Upgrade Subscription
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                                <XCircle className="mr-2 h-4 w-4"/> Unassign Course
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will unassign the course from your school, removing it from your catalog and unenrolling all current users.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleUnassignCourse(course.id)} className="bg-destructive hover:bg-destructive/90">
                                                    Unassign
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                <DialogTitle>Assign Course Visibility</DialogTitle>
                <DialogDescription>
                    Choose which group of users within your school should be able to see and enroll in "{courseToAction?.title}".
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div>
                    <Label>Target Audience</Label>
                    <Select value={assignTarget} onValueChange={(val) => setAssignTarget(val as 'all_students' | 'all_teachers' | 'class')}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_students">All Students</SelectItem>
                            <SelectItem value="all_teachers">All Teachers</SelectItem>
                            <SelectItem value="class">Specific Class (Students)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {assignTarget === 'class' && (
                    <div>
                        <Label>Select Class</Label>
                        <Select value={assignTargetClassId} onValueChange={setAssignTargetClassId}>
                            <SelectTrigger><SelectValue placeholder="Select a class..."/></SelectTrigger>
                            <SelectContent>
                                {classes.length > 0 ? classes.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>
                                )) : <SelectItem value="" disabled>No classes found</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleAssignCourse} disabled={isSubmitting || (assignTarget === 'class' && !assignTargetClassId)}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Set Visibility
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isSubscribeDialogOpen} onOpenChange={setIsSubscribeDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Upgrade Subscription</DialogTitle>
                <DialogDescription>Purchase additional seats for "{courseToAction?.title}".</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 items-center">
                    <p>Current Seats:</p>
                    <p className="font-bold text-lg">{courseToAction?.subscribed_users_count ?? 0}</p>
                    <p>Price per 10 users:</p>
                    <p className="font-bold text-lg">₹{(courseToAction?.price_per_10_users ?? 0).toFixed(2)}</p>
                </div>
                 <div>
                    <Label htmlFor="seatsToPurchase">Number of User Bundles (x10) to Add:</Label>
                    <Input id="seatsToPurchase" type="number" min="1" value={seatsToPurchase} onChange={(e) => setSeatsToPurchase(Number(e.target.value))} />
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground">Total Additional Cost</p>
                    <p className="text-2xl font-bold">
                        ₹{((courseToAction?.price_per_10_users ?? 0) * seatsToPurchase).toFixed(2)}
                    </p>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button>Proceed to Payment</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
