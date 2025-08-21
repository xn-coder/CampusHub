
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Course, UserRole, CourseWithEnrollmentStatus } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Library, Lock, Unlock, Eye, BookCheck, Loader2, BookOpen, Settings, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { getAvailableCoursesWithEnrollmentStatusAction, enrollUserInCourseAction, getLmsPageContextAction } from '@/app/(app)/lms/actions';
import { toggleFavoriteCourseAction, getFavoriteCoursesAction } from '@/app/(app)/lms/favoritesActions';
import { Badge } from '@/components/ui/badge';


export default function AvailableLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseWithEnrollmentStatus[]>([]);
  const [favoriteCourseIds, setFavoriteCourseIds] = useState<Set<string>>(new Set());
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
        setCurrentUserRole(userRoleToFetch);
        setCurrentUserId(uIdToFetch);

        if (uIdToFetch && userRoleToFetch) {
            const contextResult = await getLmsPageContextAction(uIdToFetch, userRoleToFetch);
            if(contextResult.ok) {
                userSchoolIdToFetch = contextResult.userSchoolId;
                userProfileIdToFetch = contextResult.userProfileId;
                setCurrentSchoolId(userSchoolIdToFetch);
                setCurrentUserProfileId(userProfileIdToFetch);

                // Fetch favorites
                const favResult = await getFavoriteCoursesAction(uIdToFetch);
                if (favResult.ok && favResult.courseIds) {
                    setFavoriteCourseIds(new Set(favResult.courseIds));
                }

            } else {
                 toast({ title: "Error", description: contextResult.message || "Could not load user context.", variant: "destructive" });
                 setIsLoading(false);
                 return;
            }
        }
    }

    const result = await getAvailableCoursesWithEnrollmentStatusAction({
        userProfileId: userProfileIdToFetch,
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
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleEnroll = async (courseId: string) => {
    if (!currentUserProfileId || !currentUserRole || (currentUserRole !== 'student' && currentUserRole !== 'teacher') || !currentSchoolId) {
      toast({ title: "Error", description: "User profile not identified or role invalid for enrollment.", variant: "destructive"});
      return;
    }

    setIsEnrolling(prev => ({ ...prev, [courseId]: true }));
    const result = await enrollUserInCourseAction({
      course_id: courseId,
      user_profile_id: currentUserProfileId,
      user_type: currentUserRole as 'student' | 'teacher', 
      school_id: currentSchoolId,
    });
    setIsEnrolling(prev => ({ ...prev, [courseId]: false }));

    if (result.ok) {
      toast({ title: "Enrolled Successfully!", description: "You have been enrolled in the course."});
      fetchData(); 
    } else {
      toast({ title: "Enrollment Failed", description: result.message, variant: "destructive"});
    }
  };
  
  const handleToggleFavorite = async (courseId: string) => {
      if (!currentUserId) return;
      const isCurrentlyFavorite = favoriteCourseIds.has(courseId);
      
      // Optimistically update UI
      setFavoriteCourseIds(prev => {
          const newSet = new Set(prev);
          if (isCurrentlyFavorite) {
              newSet.delete(courseId);
          } else {
              newSet.add(courseId);
          }
          return newSet;
      });

      const result = await toggleFavoriteCourseAction(currentUserId, courseId);
      if (!result.ok) {
          toast({ title: "Error", description: result.message, variant: "destructive" });
          // Revert optimistic update
          setFavoriteCourseIds(prev => {
              const newSet = new Set(prev);
              if (isCurrentlyFavorite) {
                  newSet.add(courseId);
              } else {
                  newSet.delete(courseId);
              }
              return newSet;
          });
      }
  };


  const canEnroll = currentUserRole === 'student' || currentUserRole === 'teacher';


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Available LMS Courses"
        description="Browse and enroll in courses made available by your school."
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading courses...</CardContent></Card>
      ) : courses.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No LMS courses available to you at this time.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col overflow-hidden">
               <div className="relative aspect-video">
                  <Image 
                      src={course.feature_image_url || `https://placehold.co/600x400.png`}
                      alt={course.title}
                      fill
                      className="object-cover"
                      data-ai-hint="course cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {course.school_id ? null : <Badge variant="outline">Global</Badge>}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm"
                        onClick={() => handleToggleFavorite(course.id)}
                        disabled={!currentUserId}
                      >
                        <Star className={`h-5 w-5 transition-colors ${favoriteCourseIds.has(course.id) ? 'text-yellow-400 fill-yellow-400' : 'text-white/80'}`}/>
                      </Button>
                  </div>
              </div>
              <div className="flex flex-col flex-grow p-6">
                <CardTitle className="flex items-center mb-2"><Library className="mr-2 h-5 w-5 text-primary shrink-0" />{course.title}</CardTitle>
                <CardDescription className="line-clamp-3 flex-grow">{course.description || "No description available."}</CardDescription>
                
                <CardFooter className="p-0 pt-4 flex-col sm:flex-row gap-2">
                  {canEnroll && course.isEnrolled ? (
                     <Button asChild className="w-full" variant="secondary">
                       <Link href={`/lms/courses/${course.id}`}>
                         <BookOpen className="mr-2 h-4 w-4"/> Open Course
                       </Link>
                     </Button>
                  ) : canEnroll && !course.isEnrolled ? (
                    <div className="flex w-full gap-2">
                        <Button asChild className="flex-1" variant="outline">
                            <Link href={`/lms/courses/${course.id}?preview=true`}>
                                <Eye className="mr-2 h-4 w-4"/> Preview
                            </Link>
                        </Button>
                        <Button onClick={() => handleEnroll(course.id)} className="flex-1" disabled={isEnrolling[course.id] || !currentUserProfileId}>
                          {isEnrolling[course.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookCheck className="mr-2 h-4 w-4"/>}
                          {isEnrolling[course.id] ? 'Enrolling...' : 'Enroll Now'}
                        </Button>
                    </div>
                  ) : ( // Admin/Superadmin view or user cannot enroll
                     <Button asChild className="w-full" variant="outline">
                       <Link href={`/admin/lms/courses`}>
                         <Settings className="mr-2 h-4 w-4"/> Manage Courses
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
