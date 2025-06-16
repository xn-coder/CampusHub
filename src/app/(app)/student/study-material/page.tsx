
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Course, CourseResource, Student, CourseResourceType } from '@/types';
import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Users, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface EnrichedCourse extends Pick<Course, 'id' | 'title'> {
  resources: CourseResource[];
}

type ResourceTabKey = 'ebook' | 'video' | 'note' | 'webinar';

const resourceIcons: Record<ResourceTabKey, LucideIcon> = {
  ebook: BookOpen,
  video: Video,
  note: FileText,
  webinar: Users,
};

export default function StudentStudyMaterialPage() {
  const { toast } = useToast();
  const [enrolledCoursesWithResources, setEnrolledCoursesWithResources] = useState<EnrichedCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStudyMaterial() {
      setIsLoading(true);
      const currentUserId = localStorage.getItem('currentUserId');
      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id') // students.id is the student_profile_id
          .eq('user_id', currentUserId)
          .single();

        if (studentError || !studentData || !studentData.id) {
          toast({ title: "Error", description: "Could not fetch student profile.", variant: "destructive" });
          setEnrolledCoursesWithResources([]);
          setIsLoading(false);
          return;
        }
        setStudentProfileId(studentData.id);

        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('lms_student_course_enrollments')
          .select('course_id')
          .eq('student_id', studentData.id);

        if (enrollmentsError) {
          toast({ title: "Error", description: "Failed to fetch course enrollments.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        if (!enrollments || enrollments.length === 0) {
          setEnrolledCoursesWithResources([]);
          setIsLoading(false);
          return;
        }

        const courseIds = enrollments.map(e => e.course_id);
        
        const { data: coursesData, error: coursesError } = await supabase
          .from('lms_courses')
          .select('id, title')
          .in('id', courseIds);

        if (coursesError) {
          toast({ title: "Error", description: "Failed to fetch course details.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const { data: resourcesData, error: resourcesError } = await supabase
          .from('lms_course_resources')
          .select('*')
          .in('course_id', courseIds)
          .order('type')
          .order('title');

        if (resourcesError) {
          toast({ title: "Error", description: "Failed to fetch course resources.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const enrichedData = (coursesData || []).map(course => ({
          id: course.id,
          title: course.title,
          resources: (resourcesData || []).filter(res => res.course_id === course.id),
        }));
        
        setEnrolledCoursesWithResources(enrichedData);

      } catch (error: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive"});
      } finally {
        setIsLoading(false);
      }
    }
    fetchStudyMaterial();
  }, []); // Changed dependency array to []

  const getResourceTypeLabel = (type: CourseResourceType): string => {
    switch(type) {
        case 'ebook': return 'E-Book';
        case 'video': return 'Video';
        case 'note': return 'Note';
        case 'webinar': return 'Webinar/Link';
        default: return 'Resource';
    }
  };

  const ResourceIcon = ({ type }: { type: CourseResourceType }) => {
    const IconComponent = resourceIcons[type as ResourceTabKey] || FileText;
    return <IconComponent className="mr-2 h-4 w-4 shrink-0" />;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Study Material" 
        description="Access resources for your enrolled LMS courses." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading study materials...</CardContent></Card>
      ) : !studentProfileId ? (
        <Card><CardContent className="pt-6 text-center text-destructive">Could not load student profile. Materials cannot be displayed.</CardContent></Card>
      ) : enrolledCoursesWithResources.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">You are not enrolled in any LMS courses, or no materials are available for your courses yet.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4">
          {enrolledCoursesWithResources.map((course) => (
            <AccordionItem value={course.id} key={course.id} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="bg-muted/50 hover:bg-muted px-4 py-3 text-lg font-semibold">
                {course.title} ({course.resources.length} resource(s))
              </AccordionTrigger>
              <AccordionContent className="p-0">
                {course.resources.length > 0 ? (
                  <ul className="divide-y">
                    {course.resources.map(resource => (
                      <li key={resource.id} className="p-4 hover:bg-accent/20 transition-colors">
                        <h4 className="font-medium flex items-center">
                          <ResourceIcon type={resource.type as CourseResourceType} />
                          {resource.title} 
                          <span className="ml-2 text-xs text-muted-foreground">({getResourceTypeLabel(resource.type as CourseResourceType)})</span>
                        </h4>
                        {resource.type === 'note' ? (
                           <div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap bg-background p-3 rounded-sm border max-h-40 overflow-y-auto">
                            {resource.url_or_content}
                          </div>
                        ) : (
                          <a 
                            href={resource.url_or_content} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-1 text-sm text-primary hover:underline flex items-center"
                          >
                            Access Resource <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-4 text-sm text-muted-foreground text-center">No specific resources found for this course yet.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
