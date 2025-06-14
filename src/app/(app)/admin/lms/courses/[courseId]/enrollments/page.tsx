
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Course, Student, Teacher, UserRole } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Users, Briefcase } from 'lucide-react';

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_TEACHERS_KEY = 'mockTeachersData';

export default function ManageCourseEnrollmentsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedStudentIdsToEnroll, setSelectedStudentIdsToEnroll] = useState<string[]>([]);
  const [selectedTeacherIdsToEnroll, setSelectedTeacherIdsToEnroll] = useState<string[]>([]);

  useEffect(() => {
    if (courseId && typeof window !== 'undefined') {
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      const courses: Course[] = storedCourses ? JSON.parse(storedCourses) : [];
      const foundCourse = courses.find(c => c.id === courseId);
      
      if (foundCourse) {
        setCourse(foundCourse);
      } else {
        toast({ title: "Error", description: "Course not found.", variant: "destructive" });
        router.push('/admin/lms/courses');
      }

      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setAllStudents(storedStudents ? JSON.parse(storedStudents) : []);
      
      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      setAllTeachers(storedTeachers ? JSON.parse(storedTeachers) : []);

      setIsLoading(false);
    }
  }, [courseId, router, toast]);

  const updateCourseInStorage = (updatedCourse: Course) => {
    const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
    let courses: Course[] = storedCourses ? JSON.parse(storedCourses) : [];
    courses = courses.map(c => c.id === updatedCourse.id ? updatedCourse : c);
    localStorage.setItem(MOCK_LMS_COURSES_KEY, JSON.stringify(courses));
    setCourse(updatedCourse);
  };

  const handleEnrollUsers = (userType: 'student' | 'teacher') => {
    if (!course) return;
    const updatedCourse = { ...course };
    const idsToEnroll = userType === 'student' ? selectedStudentIdsToEnroll : selectedTeacherIdsToEnroll;
    const enrollmentArrayKey = userType === 'student' ? 'enrolledStudentIds' : 'enrolledTeacherIds';
    
    const currentEnrollments = updatedCourse[enrollmentArrayKey] || [];
    const newEnrollments = Array.from(new Set([...currentEnrollments, ...idsToEnroll]));
    updatedCourse[enrollmentArrayKey] = newEnrollments;

    updateCourseInStorage(updatedCourse);
    toast({ title: `${userType.charAt(0).toUpperCase() + userType.slice(1)}(s) Enrolled`, description: `${idsToEnroll.length} user(s) enrolled.` });
    if (userType === 'student') setSelectedStudentIdsToEnroll([]);
    else setSelectedTeacherIdsToEnroll([]);
  };

  const handleUnenrollUser = (userId: string, userType: 'student' | 'teacher') => {
    if (!course) return;
    if (confirm(`Are you sure you want to unenroll this ${userType}?`)) {
      const updatedCourse = { ...course };
      const enrollmentArrayKey = userType === 'student' ? 'enrolledStudentIds' : 'enrolledTeacherIds';
      updatedCourse[enrollmentArrayKey] = (updatedCourse[enrollmentArrayKey] || []).filter(id => id !== userId);
      updateCourseInStorage(updatedCourse);
      toast({ title: `${userType.charAt(0).toUpperCase() + userType.slice(1)} Unenrolled`, variant: "destructive" });
    }
  };
  
  const availableStudentsToEnroll = allStudents.filter(s => !course?.enrolledStudentIds?.includes(s.id));
  const availableTeachersToEnroll = allTeachers.filter(t => !course?.enrolledTeacherIds?.includes(t.id));


  if (isLoading) return <div className="text-center py-10">Loading enrollment data...</div>;
  if (!course) return <div className="text-center py-10 text-destructive">Course not found.</div>;

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
              <Select onValueChange={(value) => {
                if (value && !selectedStudentIdsToEnroll.includes(value)) {
                    setSelectedStudentIdsToEnroll(prev => [...prev, value]);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select student(s) to enroll" /></SelectTrigger>
                <SelectContent>
                  {availableStudentsToEnroll.length > 0 ? availableStudentsToEnroll.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                  )) : <SelectItem value="-" disabled>No students available to enroll</SelectItem>}
                </SelectContent>
              </Select>
              {selectedStudentIdsToEnroll.length > 0 && (
                <div className="mt-2 text-sm">
                    Selected: {selectedStudentIdsToEnroll.map(id => allStudents.find(s=>s.id===id)?.name).join(', ')}
                </div>
              )}
              <Button onClick={() => handleEnrollUsers('student')} disabled={selectedStudentIdsToEnroll.length === 0}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll Selected Students
              </Button>
            </div>
            <h4 className="font-medium mb-2">Currently Enrolled Students:</h4>
            {(course.enrolledStudentIds?.length ?? 0) > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {course.enrolledStudentIds.map(id => {
                    const student = allStudents.find(s => s.id === id);
                    return student ? (
                      <TableRow key={id}>
                        <TableCell>{student.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(id, 'student')}>
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
               <Select onValueChange={(value) => {
                if (value && !selectedTeacherIdsToEnroll.includes(value)) {
                    setSelectedTeacherIdsToEnroll(prev => [...prev, value]);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select teacher(s) to enroll" /></SelectTrigger>
                <SelectContent>
                  {availableTeachersToEnroll.length > 0 ? availableTeachersToEnroll.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.subject})</SelectItem>
                  )) : <SelectItem value="-" disabled>No teachers available to enroll</SelectItem>}
                </SelectContent>
              </Select>
              {selectedTeacherIdsToEnroll.length > 0 && (
                <div className="mt-2 text-sm">
                    Selected: {selectedTeacherIdsToEnroll.map(id => allTeachers.find(t=>t.id===id)?.name).join(', ')}
                </div>
              )}
              <Button onClick={() => handleEnrollUsers('teacher')} disabled={selectedTeacherIdsToEnroll.length === 0}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll Selected Teachers
              </Button>
            </div>
            <h4 className="font-medium mb-2">Currently Enrolled Teachers:</h4>
            {(course.enrolledTeacherIds?.length ?? 0) > 0 ? (
              <Table>
                 <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {course.enrolledTeacherIds.map(id => {
                    const teacher = allTeachers.find(t => t.id === id);
                    return teacher ? (
                      <TableRow key={id}>
                        <TableCell>{teacher.name}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => handleUnenrollUser(id, 'teacher')}>
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
       <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start">
        Back to Courses
      </Button>
    </div>
  );
}
