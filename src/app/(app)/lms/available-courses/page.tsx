

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Course, UserRole, CourseWithEnrollmentStatus } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Library, Lock, Unlock, Eye, ShoppingCart, Loader2, Percent, BookOpen } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { enrollUserInCourseAction, getAvailableCoursesWithEnrollmentStatusAction } from '@/app/(app)/admin/lms/courses/actions';
import { Badge } from '@/components/ui/badge';

const currencySymbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
};

export default function AvailableLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseWithEnrollmentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    let userProfileIdToFetch: string | null = null;
    let userSchoolIdToFetch: string | null = null;
    let userRoleToFetch: UserRole | null = null;
    let uIdToFetch: string | null = null;

    if (typeof window !== 'undefined') {
      userRoleToFetch = localStorage.getItem('currentUserRole') as UserRole | null;
      uIdToFetch = localStorage.getItem('currentUserId');
      setCurrentUserRole(userRoleToFetch); // Update state for immediate use in this render cycle if needed
      setCurrentUserId(uIdToFetch);

      if (uIdToFetch && userRoleToFetch) {
        const profileTable = userRoleToFetch === 'student' ? 'students' : userRoleToFetch === 'teacher' ? 'teachers' : null;
        if (profileTable) {
          const { data: profile, error: profileError } = await supabase
            .from(profileTable)
            .select('id, school_id')
            .eq('user_id', uIdToFetch)
            .single();
          if (profileError || !profile) {
            toast({ title: "Error", description: "Could not load user profile.", variant: "destructive" });
          } else {
            userProfileIdToFetch = profile.id;
            userSchoolIdToFetch = profile.school_id;
            setCurrentUserProfileId(profile.id); // Update state
            setCurrentSchoolId(profile.school_id); // Update state
          }
        } else if (userRoleToFetch === 'admin' || userRoleToFetch === 'superadmin') {
          const { data: userRec, error: userErr } = await supabase.from('users').select('school_id').eq('id', uIdToFetch).single();
          if (userRec) {
            userSchoolIdToFetch = userRec.school_id;
            setCurrentSchoolId(userSchoolIdToFetch); // Update state
          }
        }
      }
    }

    const result = await getAvailableCoursesWithEnrollmentStatusAction({
        userProfileId: userProfileIdToFetch, // Use fetched values for this call
        userRole: userRoleToFetch,
        userSchoolId: userSchoolIdToFetch,
    });

    if (result.ok && result.courses) {
      setCourses(result.courses);
    } else {
      toast({ title: "Error", description: result.message || "Failed to fetch courses.", variant: "destructive" });
      setCourses([]);
    }
    setIsLoading(false);
  }, [toast]); // toast is stable, so this effectively runs on mount and when fetchData is called manually

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleEnrollUnpaid = async (courseId: string) => {
    if (!currentUserProfileId || !currentUserRole || (currentUserRole !== 'student' && currentUserRole !== 'teacher')) {
      toast({ title: "Error", description: "User profile not identified or role invalid for enrollment.", variant: "destructive"});
      return;
    }

    setIsEnrolling(prev => ({ ...prev, [courseId]: true }));
    const result = await enrollUserInCourseAction({
      course_id: courseId,
      user_profile_id: currentUserProfileId,
      user_type: currentUserRole as 'student' | 'teacher', // Cast because we checked
    });
    setIsEnrolling(prev => ({ ...prev, [courseId]: false }));

    if (result.ok) {
      toast({ title: "Enrolled Successfully!", description: "You have been enrolled in the course."});
      fetchData(); // Re-fetch all courses to update enrollment status
    } else {
      toast({ title: "Enrollment Failed", description: result.message, variant: "destructive"});
    }
  };

  const canEnroll = currentUserRole === 'student' || currentUserRole === 'teacher';

  const getPriceDisplay = (course: Course) => {
    if (!course.is_paid || !course.price) return null;
    const symbol = currencySymbols[course.currency || 'INR'];
    const originalPrice = course.price;
    const discount = course.discount_percentage || 0;
    const finalPrice = originalPrice * (1 - discount / 100);

    return (
        <div className="text-lg font-semibold text-foreground mb-2 flex items-baseline gap-2">
            <span>{symbol}{finalPrice.toFixed(2)}</span>
            {discount > 0 && (
                 <span className="text-sm text-muted-foreground line-through">{symbol}{originalPrice.toFixed(2)}</span>
            )}
            {discount > 0 && (
                 <Badge variant="destructive" className="flex items-center gap-1"><Percent className="h-3 w-3"/>{discount}% off</Badge>
            )}
        </div>
    );
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Available LMS Courses"
        description="Browse and enroll in courses offered by the institution."
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading courses...</CardContent></Card>
      ) : courses.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No LMS courses available at this time.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col overflow-hidden">
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
                    {course.school_id ? null : <Badge variant="outline">Global</Badge>}
                  </div>
              </div>
              <div className="flex flex-col flex-grow p-6">
                <CardTitle className="flex items-center mb-2"><Library className="mr-2 h-5 w-5 text-primary shrink-0" />{course.title}</CardTitle>
                <CardDescription className="line-clamp-3 flex-grow">{course.description || "No description available."}</CardDescription>
                <div className="mt-4">
                  {getPriceDisplay(course)}
                </div>
                <CardFooter className="p-0 pt-4 flex-col sm:flex-row gap-2">
                  {canEnroll && course.isEnrolled ? (
                     <Button asChild className="w-full" variant="secondary">
                       <Link href={`/lms/courses/${course.id}`}>
                         <Eye className="mr-2 h-4 w-4"/> View Course
                       </Link>
                     </Button>
                  ) : canEnroll && course.is_paid ? (
                     <Button asChild className="w-full" variant="outline">
                        <Link href={`/lms/courses/${course.id}?preview=true`}>
                            <Eye className="mr-2 h-4 w-4"/> Preview
                        </Link>
                    </Button>
                  ) : canEnroll && !course.is_paid ? (
                    <div className="flex w-full gap-2">
                        <Button onClick={() => handleEnrollUnpaid(course.id)} className="flex-1" disabled={isEnrolling[course.id] || !currentUserProfileId}>
                          {isEnrolling[course.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Unlock className="mr-2 h-4 w-4"/>}
                          {isEnrolling[course.id] ? 'Enrolling...' : 'Enroll Now (Free)'}
                        </Button>
                    </div>
                  ) : ( // Admin/Superadmin view or user cannot enroll
                     <Button asChild className="w-full" variant="outline">
                       <Link href={`/admin/lms/courses/${course.id}/content`}>
                         <Settings className="mr-2 h-4 w-4"/> Manage Course
                       </Link>
                     </Button>
                  )}
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
