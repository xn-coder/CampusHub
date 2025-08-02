
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CourseWithEnrollmentStatus as Course, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getCoursesForSchoolAction, assignCourseToSchoolAction, unassignCourseFromSchoolAction, updateCourseAudienceInSchoolAction } from './actions';
import { Library, Settings, UserPlus, Loader2, BookCheck, Eye, ChevronsRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ITEMS_PER_PAGE = 10;

export default function SchoolLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [allGlobalCourses, setAllGlobalCourses] = useState<Course[]>([]);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState<string>('');
  
  const [isEditAudienceDialogOpen, setIsEditAudienceDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newAudience, setNewAudience] = useState<'student' | 'teacher' | 'both'>('both');

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSchoolCourses = async (schoolId: string) => {
    setIsLoading(true);
    const result = await getCoursesForSchoolAction(schoolId);
    if (result.ok && result.courses) {
      setCourses(result.courses);
    } else {
      toast({ title: "Error", description: result.message || "Failed to load school courses.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      supabase.from('users').select('school_id').eq('id', adminUserId).single().then(({ data, error }) => {
        if (data?.school_id) {
          setCurrentSchoolId(data.school_id);
          fetchSchoolCourses(data.school_id);
        } else {
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    }
  }, [toast]);
  
  const handleOpenAssignDialog = async () => {
    setIsLoading(true);
    // Fetch all global courses not yet assigned to this school
    const { data: globalCourses, error: globalCoursesError } = await supabase
      .from('lms_courses')
      .select('id, title')
      .is('school_id', null);

    if (globalCoursesError) {
      toast({ title: "Error", description: "Could not fetch available global courses.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const assignedCourseIds = courses.map(c => c.id);
    const availableCourses = globalCourses.filter(gc => !assignedCourseIds.includes(gc.id));
    
    setAllGlobalCourses(availableCourses);
    setSelectedCourseToAssign('');
    setIsAssignDialogOpen(true);
    setIsLoading(false);
  };
  
  const handleAssignCourse = async () => {
    if (!selectedCourseToAssign || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await assignCourseToSchoolAction(selectedCourseToAssign, currentSchoolId, 'both');
    if (result.ok) {
      toast({ title: "Success", description: "Course assigned to your school." });
      if (currentSchoolId) fetchSchoolCourses(currentSchoolId);
      setIsAssignDialogOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleUnassignCourse = async (courseId: string) => {
    if (!currentSchoolId || !confirm("Are you sure you want to unassign this course from your school? This will unenroll all users.")) return;
    setIsSubmitting(true);
    const result = await unassignCourseFromSchoolAction(courseId, currentSchoolId);
     if (result.ok) {
      toast({ title: "Success", description: "Course has been unassigned from your school." });
      if (currentSchoolId) fetchSchoolCourses(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleOpenEditAudienceDialog = (course: Course) => {
    setEditingCourse(course);
    setNewAudience(course.target_audience_in_school || 'both');
    setIsEditAudienceDialogOpen(true);
  };

  const handleUpdateAudience = async () => {
    if (!editingCourse || !currentSchoolId) return;
    setIsSubmitting(true);
    const result = await updateCourseAudienceInSchoolAction(editingCourse.id, currentSchoolId, newAudience);
     if (result.ok) {
      toast({ title: "Success", description: "Course audience updated." });
      if (currentSchoolId) fetchSchoolCourses(currentSchoolId);
      setIsEditAudienceDialogOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const paginatedCourses = filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="LMS Courses for Your School"
        description="Manage courses assigned to your school and enroll your users."
        actions={
          <Button onClick={handleOpenAssignDialog} disabled={isLoading || isSubmitting}>
            <BookCheck className="mr-2 h-4 w-4" /> Assign Global Course
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Assigned Courses</CardTitle>
           <div className="flex items-center justify-between">
            <CardDescription>Courses available for enrollment at your school.</CardDescription>
            <Input 
                placeholder="Search assigned courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : paginatedCourses.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm ? 'No courses match your search.' : 'No courses have been assigned to your school yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target Audience</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{course.target_audience_in_school?.replace('_', ' & ') || 'Both'}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
                        <Link href={`/lms/courses/${course.id}?preview=true`}>
                           <Eye className="mr-1 h-3 w-3" /> Preview
                        </Link>
                      </Button>
                       <Button variant="outline" size="sm" asChild disabled={isSubmitting}>
                        <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                          <UserPlus className="mr-1 h-3 w-3" /> Enroll
                        </Link>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenEditAudienceDialog(course)} disabled={isSubmitting}>
                        <Settings className="mr-1 h-3 w-3" /> Set Audience
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleUnassignCourse(course.id)} disabled={isSubmitting}>
                        Unassign
                      </Button>
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
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Assign Course to Your School</DialogTitle>
                <DialogDescription>Select a global course to make it available for your school.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="course-assign-select">Available Global Courses</Label>
                <Select value={selectedCourseToAssign} onValueChange={setSelectedCourseToAssign}>
                    <SelectTrigger id="course-assign-select">
                        <SelectValue placeholder="Select a course..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allGlobalCourses.length > 0 ? allGlobalCourses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        )) : <SelectItem value="-" disabled>No new global courses to assign</SelectItem>}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAssignCourse} disabled={isSubmitting || !selectedCourseToAssign}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : null} Assign Course
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditAudienceDialogOpen} onOpenChange={setIsEditAudienceDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Set Target Audience for: {editingCourse?.title}</DialogTitle>
                <DialogDescription>Choose who can be enrolled in this course within your school.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
                <Label htmlFor="audience-select">Target Audience</Label>
                <Select value={newAudience} onValueChange={(val) => setNewAudience(val as any)}>
                    <SelectTrigger id="audience-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="both">Students & Teachers</SelectItem>
                        <SelectItem value="student">Students Only</SelectItem>
                        <SelectItem value="teacher">Teachers Only</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleUpdateAudience} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : null} Update Audience
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
