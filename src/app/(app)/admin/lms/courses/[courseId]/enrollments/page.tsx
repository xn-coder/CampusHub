
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Course, Student, Teacher, StudentCourseEnrollment, TeacherCourseEnrollment } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Users, Briefcase, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { enrollUserInCourseAction, unenrollUserFromCourseAction } from '../../actions';

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

export default function ManageCourseEnrollmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentCourseEnrollment[]>([]);
  const [teacherEnrollments, setTeacherEnrollments] = useState<TeacherCourseEnrollment[]>([]);
  
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [selectedStudentIdToEnroll, setSelectedStudentIdToEnroll] = useState<string>('');
  const [selectedTeacherIdToEnroll, setSelectedTeacherIdToEnroll] = useState<string>('');

  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId); // May be null for superadmin
        if (courseId) {
          fetchCourseDetails(courseId);
          fetchEnrollments(courseId, schoolId);
          fetchPotentialEnrollees(schoolId);
        }
      });
    } else {
        toast({title: "Error", description: "Admin user not identified.", variant: "destructive"});
        setIsLoadingPage(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, toast]);
  
  async function fetchCourseDetails(cId: string) {
    const { data, error } = await supabase.from('lms_courses').select('*').eq('id', cId).single();
    if (error || !data) {
      toast({ title: "Error", description: "Course not found.", variant: "destructive" });
      router.push('/admin/lms/courses');
    } else {
      setCourse(data as Course);
    }
  }

  async function fetchEnrollments(cId: string, schoolId: string | null) {
    let studentQuery = supabase
        .from('lms_student_course_enrollments')
        .select('id, student_id, course_id, enrolled_at, school_id, created_at, updated_at')
        .eq('course_id', cId);

    let teacherQuery = supabase
        .from('lms_teacher_course_enrollments')
        .select('id, teacher_id, course_id, assigned_at') // Explicitly select columns
        .eq('course_id', cId);

    if (schoolId) {
        studentQuery = studentQuery.eq('school_id', schoolId);
        // Teacher enrollments are not directly filtered by school_id on the enrollment table itself
        // We filter teachers by school when fetching potential enrollees
    }
    
    const { data: sEnroll, error: sError } = await studentQuery;
    const { data: tEnroll, error: tError } = await teacherQuery;

    if (sError) toast({ title: "Error fetching student enrollments", variant: "destructive"}); else setStudentEnrollments(sEnroll || []);
    if (tError) toast({ title: "Error fetching teacher enrollments", variant: "destructive"}); else setTeacherEnrollments(tEnroll || []);
  }

  async function fetchPotentialEnrollees(schoolId: string | null) {
    setIsLoadingPage(true); 
    if (schoolId) { 
        const { data: studentsData, error: studentsError } = await supabase.from('students').select('*').eq('school_id', schoolId);
        if (studentsError) toast({ title: "Error fetching students", variant: "destructive"}); else setAllStudents(studentsData || []);
        
        const { data: teachersData, error: teachersError } = await supabase.from('teachers').select('*').eq('school_id', schoolId);
        if (teachersError) toast({ title: "Error fetching teachers", variant: "destructive"}); else setAllTeachers(teachersData || []);
    } else { 
        const { data: studentsData, error: studentsError } = await supabase.from('students').select('*');
        if (studentsError) toast({ title: "Error fetching students", variant: "destructive"}); else setAllStudents(studentsData || []);
        
        const { data: teachersData, error: teachersError } = await supabase.from('teachers').select('*');
        if (teachersError) toast({ title: "Error fetching teachers", variant: "destructive"}); else setAllTeachers(teachersData || []);
    }
    setIsLoadingPage(false);
  }


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
      fetchEnrollments(course.id, currentSchoolId); 
      if(userType === 'student') setSelectedStudentIdToEnroll(''); else setSelectedTeacherIdToEnroll('');
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleUnenrollUser = async (userProfileId: string, userType: 'student' | 'teacher') => {
    if (!course || !currentSchoolId) return;
    if (confirm(`Are you sure you want to unenroll this ${userType}?`)) {
      setIsSubmitting(true);
      const result = await unenrollUserFromCourseAction({
        course_id: course.id,
        user_profile_id: userProfileId,
        user_type: userType,
        school_id: currentSchoolId,
      });
      if (result.ok) {
        toast({ title: `${userType.charAt(0).toUpperCase() + userType.slice(1)} Unenrolled`, variant: "destructive" });
        fetchEnrollments(course.id, currentSchoolId);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };
  
  const enrolledStudentIds = studentEnrollments.map(e => e.student_id);
  const enrolledTeacherIds = teacherEnrollments.map(e => e.teacher_id);

  const availableStudentsToEnroll = allStudents.filter(s => !enrolledStudentIds.includes(s.id));
  const availableTeachersToEnroll = allTeachers.filter(t => !enrolledTeacherIds.includes(t.id));

  if (isLoadingPage) return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading enrollment data...</div>;
  if (!course) return <div className="text-center py-10 text-destructive">Course not found.</div>;
  if (!currentSchoolId && course.school_id) { 
    return <div className="text-center py-10 text-destructive">Admin not associated with a school to manage enrollments for this school-specific course.</div>;
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Enrollments: ${course.title}`} description="Enroll or unenroll students and teachers from this course." />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Student Enrollments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Student Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <Label>Enroll New Students</Label>
              <Select value={selectedStudentIdToEnroll} onValueChange={setSelectedStudentIdToEnroll} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="Select student(s) to enroll" /></SelectTrigger>
                <SelectContent>
                  {availableStudentsToEnroll.length > 0 ? availableStudentsToEnroll.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                  )) : <SelectItem value="-" disabled>No students available to enroll</SelectItem>}
                </SelectContent>
              </Select>
              <Button onClick={() => handleEnrollUser('student')} disabled={isSubmitting || !selectedStudentIdToEnroll}>
                {isSubmitting && selectedStudentIdToEnroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />} Enroll Student
              </Button>
            </div>
            <h4 className="font-medium mb-2">Currently Enrolled Students:</h4>
            {studentEnrollments.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {studentEnrollments.map(enrollment => {
                    const student = allStudents.find(s => s.id === enrollment.student_id);
                    return student ? (
                      <TableRow key={enrollment.id}>
                        <TableCell>{student.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(student.id, 'student')} disabled={isSubmitting}>
                            <UserMinus className="mr-1 h-3 w-3" /> Unenroll
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : null;
                  })}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No students enrolled yet.</p>}
          </CardContent>
        </Card>

        {/* Teacher Enrollments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5" />Teacher Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <Label>Enroll New Teachers</Label>
               <Select value={selectedTeacherIdToEnroll} onValueChange={setSelectedTeacherIdToEnroll} disabled={isSubmitting}>
                <SelectTrigger><SelectValue placeholder="Select teacher(s) to enroll" /></SelectTrigger>
                <SelectContent>
                  {availableTeachersToEnroll.length > 0 ? availableTeachersToEnroll.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.subject})</SelectItem>
                  )) : <SelectItem value="-" disabled>No teachers available to enroll</SelectItem>}
                </SelectContent>
              </Select>
              <Button onClick={() => handleEnrollUser('teacher')} disabled={isSubmitting || !selectedTeacherIdToEnroll}>
                {isSubmitting && selectedTeacherIdToEnroll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />} Enroll Teacher
              </Button>
            </div>
            <h4 className="font-medium mb-2">Currently Enrolled Teachers:</h4>
            {teacherEnrollments.length > 0 ? (
              <Table>
                 <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {teacherEnrollments.map(enrollment => {
                    const teacher = allTeachers.find(t => t.id === enrollment.teacher_id);
                    return teacher ? (
                      <TableRow key={enrollment.id}>
                        <TableCell>{teacher.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(teacher.id, 'teacher')} disabled={isSubmitting}>
                            <UserMinus className="mr-1 h-3 w-3" /> Unenroll
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : null;
                  })}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">No teachers enrolled yet.</p>}
          </CardContent>
        </Card>
      </div>
       <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start" disabled={isSubmitting}>
        Back to Courses
      </Button>
    </div>
  );
}
