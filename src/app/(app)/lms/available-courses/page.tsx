
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Course, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Library, Lock, Unlock, CheckCircle, ExternalLink, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';

export default function AvailableLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      setCourses(storedCourses ? JSON.parse(storedCourses) : []);
      
      const role = localStorage.getItem('currentUserRole') as UserRole | null;
      const userId = localStorage.getItem('currentUserId');
      setCurrentUserRole(role);
      setCurrentUserId(userId);
    }
    setIsLoading(false);
  }, []);

  const updateLocalStorageCourses = (updatedCourses: Course[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_LMS_COURSES_KEY, JSON.stringify(updatedCourses));
    }
  };

  const handleEnrollUnpaid = (courseId: string) => {
    if (!currentUserId || !currentUserRole) {
      toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive"});
      return;
    }

    const updatedCourses = courses.map(course => {
      if (course.id === courseId) {
        const enrollmentArray = currentUserRole === 'student' ? 'enrolledStudentIds' : 'enrolledTeacherIds';
        if (!course[enrollmentArray].includes(currentUserId)) {
          return { ...course, [enrollmentArray]: [...course[enrollmentArray], currentUserId] };
        }
      }
      return course;
    });

    setCourses(updatedCourses);
    updateLocalStorageCourses(updatedCourses);
    toast({ title: "Enrolled Successfully!", description: "You have been enrolled in the course."});
  };

  const isUserEnrolled = (course: Course): boolean => {
    if (!currentUserId || !currentUserRole) return false;
    const enrollmentArray = currentUserRole === 'student' ? course.enrolledStudentIds : course.enrolledTeacherIds;
    return enrollmentArray.includes(currentUserId);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Available LMS Courses" 
        description="Browse and enroll in courses offered by the institution." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading courses...</CardContent></Card>
      ) : courses.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No LMS courses available at this time.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center"><Library className="mr-2 h-5 w-5 text-primary" />{course.title}</CardTitle>
                    {course.isPaid ? (
                        <span className="text-xs font-semibold bg-destructive/20 text-destructive px-2 py-1 rounded-full flex items-center">
                            <Lock className="mr-1 h-3 w-3"/> Paid
                        </span>
                    ) : (
                         <span className="text-xs font-semibold bg-green-500/20 text-green-700 px-2 py-1 rounded-full flex items-center">
                            <Unlock className="mr-1 h-3 w-3"/> Unpaid
                        </span>
                    )}
                </div>
                <CardDescription className="line-clamp-3">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {course.isPaid && course.price && (
                  <p className="text-lg font-semibold text-foreground mb-2">${course.price.toFixed(2)}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {course.enrolledStudentIds.length + course.enrolledTeacherIds.length} enrolled.
                </p>
              </CardContent>
              <CardFooter>
                {isUserEnrolled(course) ? (
                  <Button variant="outline" disabled className="w-full">
                    <CheckCircle className="mr-2 h-4 w-4"/> Enrolled
                  </Button>
                ) : course.isPaid ? (
                  currentUserRole === 'student' ? (
                    <Button asChild className="w-full">
                      <Link href={`/student/lms/activate?courseId=${course.id}`}>
                         <ShoppingCart className="mr-2 h-4 w-4"/> Activate Course
                      </Link>
                    </Button>
                  ) : ( // Teachers might need a different flow for paid courses, or same as student
                     <Button asChild className="w-full">
                      <Link href={`/student/lms/activate?courseId=${course.id}`}> {/* Assuming teachers use same activation page for now */}
                        <ShoppingCart className="mr-2 h-4 w-4"/> Activate Course
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button onClick={() => handleEnrollUnpaid(course.id)} className="w-full">
                    <Unlock className="mr-2 h-4 w-4"/> Enroll Now (Free)
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
