
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CourseWithEnrollmentStatus as Course, UserRole, ClassData } from '@/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { getCoursesForSchoolAction, assignCourseToSchoolAudienceAction } from './actions';
import { Library, Settings, UserPlus, Loader2, Eye, Search, ChevronLeft, ChevronRight, Lock, Unlock, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ITEMS_PER_PAGE = 9;

export default function SchoolLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [courseToAction, setCourseToAction] = useState<Course | null>(null);
  const [assignTarget, setAssignTarget] = useState<'all_students' | 'all_teachers' | 'class'>('all_students');
  const [assignTargetClassId, setAssignTargetClassId] = useState<string>('');
  

  const fetchSchoolData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const [coursesResult, classesResult] = await Promise.all([
      getCoursesForSchoolAction(schoolId),
      supabase.from('classes').select('*').eq('school_id', schoolId)
    ]);
    
    if (coursesResult.ok && coursesResult.courses) {
      setCourses(coursesResult.courses);
    } else {
      toast({ title: "Error", description: coursesResult.message || "Failed to load school courses.", variant: "destructive" });
    }

    if(classesResult.error) {
       toast({ title: "Error", description: "Failed to load class list for assignment.", variant: "destructive" });
    } else {
       setClasses(classesResult.data || []);
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      supabase.from('users').select('school_id').eq('id', adminUserId).single().then(({ data, error }) => {
        if (data?.school_id) {
          setCurrentSchoolId(data.school_id);
          fetchSchoolData(data.school_id);
        } else {
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    }
  }, [toast, fetchSchoolData]);
  
  const handleOpenAssignDialog = (course: Course) => {
    setCourseToAction(course);
    setAssignTarget('all_students');
    setAssignTargetClassId('');
    setIsAssignDialogOpen(true);
  };

  const handleOpenSubscriptionDialog = (course: Course) => {
    setCourseToAction(course);
    setIsSubscriptionDialogOpen(true);
  }

  const handleAssignCourse = async () => {
    if (!courseToAction || !currentSchoolId || !assignTarget) return;
    if (assignTarget === 'class' && !assignTargetClassId) {
      toast({ title: "Error", description: "Please select a class.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await assignCourseToSchoolAudienceAction({
      courseId: courseToAction.id,
      schoolId: currentSchoolId,
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
  
  const handleEnrollOrSubscribe = async (course: Course) => {
      // For both free and paid, "enrolling" means the school adopts it.
      // This is a placeholder for a more complex subscription flow.
      // For now, we'll just simulate success and update the UI state.
      setIsSubmitting(true);
      toast({title: "Processing...", description: `Enrolling your school in "${course.title}".`});
      await new Promise(res => setTimeout(res, 1000)); // Simulate network latency

      setCourses(prev => prev.map(c => c.id === course.id ? {...c, isEnrolled: true} : c));

      toast({title: "Success!", description: `Your school now has access to "${course.title}". You can assign it to users.`});
      setIsSubscriptionDialogOpen(false);
      setCourseToAction(null);
      setIsSubmitting(false);
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCourses.map((course) => (
                    <Card key={course.id} className="flex flex-col overflow-hidden group">
                        <div className="relative aspect-video">
                            <Image 
                                src={course.feature_image_url || `https://placehold.co/600x400.png`}
                                alt={course.title}
                                layout="fill"
                                objectFit="cover"
                                data-ai-hint="course cover"
                            />
                             <div className="absolute top-2 right-2 flex gap-1">
                                {course.is_paid ? (
                                    <Badge variant="destructive" className="flex items-center"><Lock className="mr-1 h-3 w-3"/> Paid</Badge>
                                ) : (
                                    <Badge className="bg-green-600 hover:bg-green-700 flex items-center"><Unlock className="mr-1 h-3 w-3"/> Free</Badge>
                                )}
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
                                    <UserPlus className="mr-2 h-4 w-4"/> Manage Enrollments
                                </Link>
                              </Button>
                              <Button className="w-full" variant="outline" onClick={() => handleOpenAssignDialog(course)}>
                                Assign To
                              </Button>
                             </>
                           ) : (
                             <>
                               <Button asChild variant="outline" className="w-full">
                                <Link href={`/lms/courses/${course.id}?preview=true`}>
                                  <Eye className="mr-2 h-4 w-4"/> Preview
                                </Link>
                               </Button>
                               {course.is_paid ? (
                                  <Button onClick={() => handleOpenSubscriptionDialog(course)} className="w-full">
                                    <CreditCard className="mr-2 h-4 w-4"/> Subscribe
                                  </Button>
                               ) : (
                                  <Button onClick={() => handleEnrollOrSubscribe(course)} className="w-full" disabled={isSubmitting}>
                                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4"/>}
                                      Enroll School (Free)
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

    <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Subscription Details: {courseToAction?.title}</DialogTitle>
                <DialogDescription>Information about this paid course offering.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
                <div className="flex justify-between items-baseline"><span className="text-muted-foreground">Plan:</span> <span className="font-semibold capitalize">{courseToAction?.subscription_plan?.replace('_', ' ')}</span></div>
                <div className="flex justify-between items-baseline"><span className="text-muted-foreground">Price:</span> <span className="font-semibold">₹{courseToAction?.price?.toFixed(2)}</span></div>
                <div className="flex justify-between items-baseline"><span className="text-muted-foreground">User Limit:</span> <span className="font-semibold">{courseToAction?.max_users_allowed || 'Unlimited'}</span></div>
            </div>
             <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={() => courseToAction && handleEnrollOrSubscribe(courseToAction)} disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CreditCard className="mr-2 h-4 w-4" />}
                   Pay Now & Activate
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Assign Course: {courseToAction?.title}</DialogTitle>
                <DialogDescription>Make this course available to specific groups within your school.</DialogDescription>
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
