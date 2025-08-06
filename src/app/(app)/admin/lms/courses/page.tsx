
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CourseWithEnrollmentStatus as Course, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { getCoursesForSchoolAction } from './actions';
import { Library, Settings, UserPlus, Loader2, BookCheck, Eye, ChevronsRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 9;

export default function SchoolLmsCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
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
                                <Badge variant="outline">{course.target_audience_in_school?.replace('_', ' & ') || 'Both'}</Badge>
                            </div>
                        </div>
                        <CardHeader>
                            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <CardDescription className="line-clamp-3">{course.description || "No description available."}</CardDescription>
                        </CardContent>
                        <CardFooter className="flex-col sm:flex-row gap-2">
                             <Button asChild className="w-full" variant="secondary">
                                <Link href={`/admin/lms/courses/${course.id}/content`}>
                                    <Settings className="mr-2 h-4 w-4"/> Manage
                                </Link>
                             </Button>
                             <Button asChild className="w-full" variant="outline">
                               <Link href={`/lms/courses/${course.id}?preview=true`}>
                                 <Eye className="mr-2 h-4 w-4"/> Preview
                               </Link>
                             </Button>
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
  );
}
