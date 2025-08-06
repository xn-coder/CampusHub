

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Course, Student, Teacher, UserRole } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Users, Briefcase, Loader2, Info } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { enrollUserInCourseAction, unenrollUserFromCourseAction, getEnrolledStudentsForCourseAction, getEnrolledTeachersForCourseAction } from '../actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
    const { data: userRec, error: userErr } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
    if (userErr || !userRec || !userRec.school_id) {
        console.warn("Could not determine admin's school_id from users table:", userErr?.message);
        return null;
    }
    return userRec.school_id;
}


export default function ManageCourseEnrollmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [allStudentsForDropdown, setAllStudentsForDropdown] = useState<Student[]>([]);
  const [allTeachersForDropdown, setAllTeachersForDropdown] = useState<Teacher[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [enrolledTeachers, setEnrolledTeachers] = useState<Teacher[]>([]);
  
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [selectedStudentIdToEnroll, setSelectedStudentIdToEnroll] = useState<string>('');
  const [selectedTeacherIdToEnroll, setSelectedTeacherIdToEnroll] = useState<string>('');
  
  const fetchCurrentlyEnrolledUsers = useCallback(async (cId: string) => {
    if (!cId) return;
    setIsLoadingEnrollments(true);
    const [studentsResult, teachersResult] = await Promise.all([
        getEnrolledStudentsForCourseAction(cId),
        getEnrolledTeachersForCourseAction(cId)
    ]);

    if (studentsResult.ok && studentsResult.students) {
        setEnrolledStudents(studentsResult.students.filter(s => s.school_id === currentSchoolId));
    } else {
        toast({ title: "Error fetching enrolled students", description: studentsResult.message, variant: "destructive"});
        setEnrolledStudents([]);
    }

    if (teachersResult.ok && teachersResult.teachers) {
        setEnrolledTeachers(teachersResult.teachers.filter(t => t.school_id === currentSchoolId));
    } else {
        toast({ title: "Error fetching enrolled teachers", description: teachersResult.message, variant: "destructive"});
        setEnrolledTeachers([]);
    }
    setIsLoadingEnrollments(false);
  }, [currentSchoolId, toast]);

  const fetchCourseDetailsAndPotentialEnrollees = useCallback(async (cId: string, adminSchoolId: string | null) => {
    setIsLoadingPage(true);
    const { data: courseData, error: courseError } = await supabase.from('lms_courses').select('*').eq('id', cId).single();
    if (courseError || !courseData) {
      toast({ title: "Error", description: "Course not found.", variant: "destructive" });
      router.push('/admin/lms/courses');
      setIsLoadingPage(false);
      return;
    }
    const loadedCourse = courseData as Course;
    setCourse(loadedCourse);

    if (adminSchoolId) {
        const { data: studentsData, error: studentsError } = await supabase.from('students').select('id, name, email').eq('school_id', adminSchoolId);
        if (studentsError) toast({ title: "Error fetching students", variant: "destructive"}); else setAllStudentsForDropdown(studentsData || []);
        
        const { data: teachersData, error: teachersError } = await supabase.from('teachers').select('id, name, subject').eq('school_id', adminSchoolId);
        if (teachersError) toast({ title: "Error fetching teachers", variant: "destructive"}); else setAllTeachersForDropdown(teachersData || []);
    } else {
        setAllStudentsForDropdown([]);
        setAllTeachersForDropdown([]);
    }
    setIsLoadingPage(false);
  }, [router, toast]);


  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId); 
        if (courseId) {
          fetchCourseDetailsAndPotentialEnrollees(courseId, schoolId);
          fetchCurrentlyEnrolledUsers(courseId);
        } else {
            setIsLoadingPage(false);
        }
      });
    } else {
        toast({title: "Error", description: "Admin user not identified.", variant: "destructive"});
        setIsLoadingPage(false);
    }
  }, [courseId, toast, fetchCourseDetailsAndPotentialEnrollees, fetchCurrentlyEnrolledUsers]);
  

  const handleEnrollUser = async (userType: 'student' | 'teacher') => {
    if (!course || !currentSchoolId) { 
        toast({title: "Error", description: "Course or school context missing.", variant: "destructive"});
        return;
    }
    const userProfileId = userType === 'student' ? selectedStudentIdToEnroll : selectedTeacherIdToEnroll;
    if (!userProfileId) {
        toast({title: "Error", description: `Please select a ${userType} to enroll.`, variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    
    const result = await enrollUserInCourseAction({
      course_id: course.id,
      user_profile_id: userProfileId,
      user_type: userType,
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: `${userType.charAt(0).toUpperCase() + userType.slice(1)} Enrolled`, description: result.message });
      fetchCurrentlyEnrolledUsers(course.id); 
      if(userType === 'student') setSelectedStudentIdToEnroll(''); else setSelectedTeacherIdToEnroll('');
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleUnenrollUser = async (userProfileId: string, userType: 'student' | 'teacher') => {
    if (!course) return;
    if (confirm(`Are you sure you want to unenroll this ${userType}?`)) {
      setIsSubmitting(true);
      const result = await unenrollUserFromCourseAction({
        course_id: course.id,
        user_profile_id: userProfileId,
        user_type: userType,
      });
      if (result.ok) {
        toast({ title: `${userType.charAt(0).toUpperCase() + userType.slice(1)} Unenrolled`, variant: "destructive" });
        fetchCurrentlyEnrolledUsers(course.id);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };
  
  const enrolledStudentIds = enrolledStudents.map(s => s.id);
  const enrolledTeacherIds = enrolledTeachers.map(t => t.id);

  const availableStudentsToEnroll = allStudentsForDropdown.filter(s => !enrolledStudentIds.includes(s.id));
  const availableTeachersToEnroll = allTeachersForDropdown.filter(t => !enrolledTeacherIds.includes(t.id));

  if (isLoadingPage && !course) return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course details...</div>;
  if (!course) return <div className="text-center py-10 text-destructive">Course not found.</div>;
  
  const renderStudentEnrollmentCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Student Enrollments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <Label htmlFor="student-select">Enroll New Students</Label>
          <Select value={selectedStudentIdToEnroll} onValueChange={setSelectedStudentIdToEnroll} disabled={isSubmitting || isLoadingPage}>
            <SelectTrigger id="student-select"><SelectValue placeholder="Select student to enroll" /></SelectTrigger>
            <SelectContent>
              {availableStudentsToEnroll.length > 0 ? availableStudentsToEnroll.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
              )) : <SelectItem value="-" disabled>No students available to enroll</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={() => handleEnrollUser('student')} disabled={isSubmitting || !selectedStudentIdToEnroll || isLoadingPage}>
            {isSubmitting && selectedStudentIdToEnroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />} Enroll Student
          </Button>
        </div>
        <h4 className="font-medium mb-2">Currently Enrolled Students:</h4>
        {isLoadingEnrollments ? <div className="text-center py-2"><Loader2 className="h-5 w-5 animate-spin"/></div> :
        enrolledStudents.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {enrolledStudents.map(student => (
                  <TableRow key={student.id}>
                    <TableCell>{student.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(student.id, 'student')} disabled={isSubmitting}>
                        <UserMinus className="mr-1 h-3 w-3" /> Unenroll
                      </Button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-muted-foreground">No students enrolled yet.</p>}
      </CardContent>
    </Card>
  );

  const renderTeacherEnrollmentCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5" />Teacher Enrollments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <Label htmlFor="teacher-select">Enroll New Teachers</Label>
           <Select value={selectedTeacherIdToEnroll} onValueChange={setSelectedTeacherIdToEnroll} disabled={isSubmitting || isLoadingPage}>
            <SelectTrigger id="teacher-select"><SelectValue placeholder="Select teacher to enroll" /></SelectTrigger>
            <SelectContent>
              {availableTeachersToEnroll.length > 0 ? availableTeachersToEnroll.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({t.subject})</SelectItem>
              )) : <SelectItem value="-" disabled>No teachers available to enroll</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={() => handleEnrollUser('teacher')} disabled={isSubmitting || !selectedTeacherIdToEnroll || isLoadingPage}>
            {isSubmitting && selectedTeacherIdToEnroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />} Enroll Teacher
          </Button>
        </div>
        <h4 className="font-medium mb-2">Currently Enrolled Teachers:</h4>
         {isLoadingEnrollments ? <div className="text-center py-2"><Loader2 className="h-5 w-5 animate-spin"/></div> :
        enrolledTeachers.length > 0 ? (
          <Table>
             <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {enrolledTeachers.map(teacher => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(teacher.id, 'teacher')} disabled={isSubmitting}>
                        <UserMinus className="mr-1 h-3 w-3" /> Unenroll
                      </Button>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-muted-foreground">No teachers enrolled yet.</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Enrollments: ${course.title}`} description="Enroll or unenroll users from this course." />
      
      <div className="grid md:grid-cols-2 gap-6">
        {course.target_audience === 'student' && renderStudentEnrollmentCard()}
        {course.target_audience === 'teacher' && renderTeacherEnrollmentCard()}
        {course.target_audience === 'both' && (
          <>
            {renderStudentEnrollmentCard()}
            {renderTeacherEnrollmentCard()}
          </>
        )}
      </div>
      
       <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start" disabled={isSubmitting}>
        Back to Courses
      </Button>
    </div>
  );
}
