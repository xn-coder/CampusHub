
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users, Loader2, ExternalLink } from 'lucide-react';
import type { Course, LmsLesson, CourseResource, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { 
  addLessonAction, 
  deleteLessonAction, 
  getCourseDetailsForAdminAction,
  addResourceToLessonAction,
  deleteCourseResourceAction
} from '../../actions';

type ResourceTabKey = 'ebook' | 'video' | 'note' | 'webinar';

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean | string>(false); // Use string for lesson-specific loading

  const [newLessonTitle, setNewLessonTitle] = useState('');
  
  // Resource Form State
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceTabKey>('note');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');

  const fetchCourseData = async () => {
    setIsLoading(true);
    const result = await getCourseDetailsForAdminAction(courseId);
    if (result.ok) {
      setCourse(result.course || null);
      setLessons(result.lessons || []);
    } else {
      toast({ title: "Error", description: result.message || "Failed to load course details.", variant: "destructive" });
      router.push('/admin/lms/courses');
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleAddLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim() || !course) return;

    setIsSubmitting('lesson');
    const result = await addLessonAction({
      course_id: course.id,
      title: newLessonTitle.trim(),
      order: (lessons.length || 0) + 1,
    });

    if (result.ok) {
      toast({ title: "Lesson Added", description: `"${newLessonTitle}" has been added.` });
      setNewLessonTitle('');
      await fetchCourseData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteLesson = async (lessonId: string) => {
    if (confirm("Are you sure you want to delete this lesson and all its resources? This action cannot be undone.")) {
      setIsSubmitting(lessonId);
      const result = await deleteLessonAction(lessonId);
      if (result.ok) {
        toast({ title: "Lesson Deleted", variant: "destructive" });
        await fetchCourseData();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };

  const resetResourceForm = () => {
    setResourceTitle('');
    setResourceUrlOrContent('');
    setResourceType('note');
  };

  const handleAddResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeLessonId || !resourceTitle.trim() || !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "Title and Content/URL are required for the resource.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(activeLessonId);
    const result = await addResourceToLessonAction({
      lesson_id: activeLessonId,
      course_id: courseId,
      title: resourceTitle.trim(),
      type: resourceType,
      url_or_content: resourceUrlOrContent.trim(),
    });

    if (result.ok) {
      toast({ title: "Resource Added" });
      resetResourceForm();
      await fetchCourseData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteResource = async (resourceId: string, lessonId: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
        setIsSubmitting(lessonId);
        const result = await deleteCourseResourceAction(resourceId);
        if (result.ok) {
            toast({ title: "Resource Deleted", variant: "destructive" });
            await fetchCourseData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    }
  };


  if (isLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course details...</div>;
  }
  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found. It might have been deleted.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add, edit, or remove lessons and their resources for this course." />
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Lesson</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLesson} className="flex items-center gap-2">
            <Input
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              placeholder="e.g., Introduction to Algebra"
              className="flex-grow"
              disabled={isSubmitting === 'lesson'}
            />
            <Button type="submit" disabled={isSubmitting === 'lesson' || !newLessonTitle.trim()}>
              {isSubmitting === 'lesson' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} 
              Add Lesson
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Course Lessons</CardTitle>
          <CardDescription>Manage the resources within each lesson. Lessons are displayed in the order they are created.</CardDescription>
        </CardHeader>
        <CardContent>
          {lessons.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" onValueChange={setActiveLessonId}>
              {lessons.map(lesson => (
                <AccordionItem value={lesson.id} key={lesson.id}>
                  <div className="flex items-center">
                    <AccordionTrigger className="flex-grow">{lesson.title}</AccordionTrigger>
                    <Button variant="ghost" size="icon" className="ml-2" onClick={() => handleDeleteLesson(lesson.id)} disabled={!!isSubmitting}>
                      <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                  </div>
                  <AccordionContent className="p-4 bg-muted/50 rounded-md">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left side: Add Resource Form */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-md">Add Resource to "{lesson.title}"</h4>
                        <form onSubmit={handleAddResource} className="space-y-4">
                          <Input name="lessonId" type="hidden" value={lesson.id}/>
                          <div>
                            <Label htmlFor={`resource-title-${lesson.id}`}>Resource Title</Label>
                            <Input id={`resource-title-${lesson.id}`} value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g., Chapter 1 PDF" disabled={isSubmitting === lesson.id} />
                          </div>
                          <div>
                            <Label>Resource Type</Label>
                            <RadioGroup value={resourceType} onValueChange={(val) => setResourceType(val as ResourceTabKey)} className="flex space-x-4">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="note" id={`type-note-${lesson.id}`} /><Label htmlFor={`type-note-${lesson.id}`}>Note</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="video" id={`type-video-${lesson.id}`} /><Label htmlFor={`type-video-${lesson.id}`}>Video</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="ebook" id={`type-ebook-${lesson.id}`} /><Label htmlFor={`type-ebook-${lesson.id}`}>E-book</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="webinar" id={`type-webinar-${lesson.id}`} /><Label htmlFor={`type-webinar-${lesson.id}`}>Webinar</Label></div>
                            </RadioGroup>
                          </div>
                          <div>
                            <Label htmlFor={`resource-content-${lesson.id}`}>{resourceType === 'note' ? 'Content' : 'URL'}</Label>
                            <Textarea id={`resource-content-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder={resourceType === 'note' ? 'Enter text content...' : 'Enter full URL...'} disabled={isSubmitting === lesson.id} />
                          </div>
                           <Button type="submit" disabled={isSubmitting === lesson.id}>
                            {isSubmitting === lesson.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} 
                            Add Resource
                          </Button>
                        </form>
                      </div>
                      {/* Right side: Existing Resources List */}
                      <div>
                         <h4 className="font-semibold text-md mb-2">Existing Resources</h4>
                         {lesson.resources && lesson.resources.length > 0 ? (
                            <ul className="space-y-2 max-h-72 overflow-y-auto">
                              {lesson.resources.map(resource => (
                                <li key={resource.id} className="flex justify-between items-center p-2 border rounded-md bg-background">
                                  <div className="truncate">
                                      <p className="font-medium truncate" title={resource.title}>{resource.title}</p>
                                      <p className="text-xs text-muted-foreground">{resource.type}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteResource(resource.id, lesson.id)} disabled={!!isSubmitting}>
                                      <Trash2 className="h-4 w-4 text-destructive"/>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                         ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No resources added to this lesson yet.</p>
                         )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-center text-muted-foreground py-4">No lessons created yet. Add one above to get started.</p>
          )}
        </CardContent>
      </Card>
      <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start" disabled={!!isSubmitting}>
        Back to Courses
      </Button>
    </div>
  );
}
