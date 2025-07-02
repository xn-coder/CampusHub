

"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users as WebinarIcon, Loader2, GripVertical } from 'lucide-react';
import type { Course, CourseResource, LessonContentResource } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { 
  getCourseContentForAdminAction,
  addLessonToCourseAction,
  deleteCourseResourceAction,
  updateLessonContentAction,
} from '../../actions';

type ResourceTabKey = 'note' | 'video' | 'ebook' | 'webinar';

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  const [isResourceFormOpen, setIsResourceFormOpen] = useState<string | null>(null); // Holds lesson ID
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceTabKey>('note');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');


  const fetchCourseData = async () => {
    setIsLoading(true);
    const result = await getCourseContentForAdminAction(courseId);
    if (result.ok) {
      setCourse(result.course || null);
      // Lessons are stored as resources of type 'note'
      setLessons(result.resources?.filter(r => r.type === 'note') || []);
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
    if (!newLessonTitle.trim()) return;
    setIsSubmitting(true);
    const result = await addLessonToCourseAction({
      course_id: courseId,
      title: newLessonTitle.trim(),
    });
    if (result.ok) {
      toast({ title: "Lesson Added" });
      setNewLessonTitle('');
      setIsLessonFormOpen(false);
      await fetchCourseData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteLesson = async (lessonId: string) => {
    if (confirm("Are you sure you want to delete this entire lesson and all its contents? This cannot be undone.")) {
      setIsSubmitting(true);
      const result = await deleteCourseResourceAction(lessonId);
      if (result.ok) {
        toast({ title: "Lesson Deleted", variant: "destructive" });
        await fetchCourseData();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };

  const openResourceForm = (lessonId: string) => {
    setIsResourceFormOpen(lessonId);
    setResourceTitle('');
    setResourceType('note');
    setResourceUrlOrContent('');
  };

  const handleAddResourceToLesson = async (e: FormEvent, lesson: CourseResource) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceUrlOrContent.trim()) {
      toast({title: "Error", description: "Resource title and content/URL are required.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    
    let currentContent: LessonContentResource[] = [];
    try {
      currentContent = JSON.parse(lesson.url_or_content || '[]');
    } catch(err) {
       toast({title: "Error", description: "Could not parse existing lesson content.", variant: "destructive"});
       setIsSubmitting(false);
       return;
    }
    
    const newResource: LessonContentResource = {
        id: uuidv4(),
        type: resourceType,
        title: resourceTitle.trim(),
        url_or_content: resourceUrlOrContent.trim()
    };
    
    const updatedContent = [...currentContent, newResource];
    
    const result = await updateLessonContentAction(lesson.id, updatedContent);

    if (result.ok) {
        toast({title: "Resource Added"});
        setIsResourceFormOpen(null);
        await fetchCourseData();
    } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
  };

  const handleDeleteResourceFromLesson = async (lesson: CourseResource, contentId: string) => {
     if (!confirm("Are you sure you want to delete this resource?")) return;
     
     setIsSubmitting(true);
     const currentContent: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]');
     const updatedContent = currentContent.filter(res => res.id !== contentId);

     const result = await updateLessonContentAction(lesson.id, updatedContent);
     if (result.ok) {
        toast({title: "Resource Deleted", variant: "destructive"});
        await fetchCourseData();
     } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
     }
     setIsSubmitting(false);
  };


  if (isLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course details...</div>;
  }
  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found. It might have been deleted.</div>;
  }

  const getResourceIcon = (type: string) => {
    const props = { className: "mr-2 h-4 w-4 text-muted-foreground" };
    switch(type) {
      case 'ebook': return <BookOpen {...props} />;
      case 'video': return <Video {...props} />;
      case 'note': return <FileText {...props} />;
      case 'webinar': return <WebinarIcon {...props} />;
      default: return null;
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add lessons and organize your course resources like videos, notes, and e-books." />
      
      <Card>
        <CardHeader>
            <CardTitle>Course Structure</CardTitle>
            <CardDescription>Add, remove, and manage lessons for this course.</CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                {lessons.map(lesson => {
                    const lessonContents: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]');
                    return (
                        <AccordionItem value={lesson.id} key={lesson.id} className="border rounded-md bg-background">
                            <AccordionTrigger className="px-4 hover:no-underline">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center">
                                        <GripVertical className="h-5 w-5 text-muted-foreground mr-2" />
                                        <span className="font-semibold">{lesson.title}</span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">{lessonContents.length} resource(s)</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pt-2 border-t">
                               <div className="space-y-3">
                                   {lessonContents.length > 0 ? lessonContents.map(res => (
                                       <div key={res.id} className="flex justify-between items-center p-2 border rounded-md">
                                           <div className="flex items-center truncate">
                                                {getResourceIcon(res.type)}
                                                <span className="truncate" title={res.title}>{res.title}</span>
                                           </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteResourceFromLesson(lesson, res.id)} disabled={isSubmitting}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                       </div>
                                   )) : <p className="text-sm text-muted-foreground text-center py-2">No resources in this lesson yet.</p>}
                               </div>
                               
                               {isResourceFormOpen === lesson.id ? (
                                   <Card className="mt-4 bg-muted/50">
                                       <CardHeader><CardTitle className="text-base">Add New Resource to "{lesson.title}"</CardTitle></CardHeader>
                                       <CardContent>
                                           <form onSubmit={(e) => handleAddResourceToLesson(e, lesson)} className="space-y-4">
                                               <div>
                                                   <Label>Resource Type</Label>
                                                   <RadioGroup value={resourceType} onValueChange={(val) => setResourceType(val as ResourceTabKey)} className="flex space-x-4 pt-1">
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="note" id={`type-note-${lesson.id}`} /><Label htmlFor={`type-note-${lesson.id}`}>Note</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="video" id={`type-video-${lesson.id}`} /><Label htmlFor={`type-video-${lesson.id}`}>Video</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="ebook" id={`type-ebook-${lesson.id}`} /><Label htmlFor={`type-ebook-${lesson.id}`}>E-book</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="webinar" id={`type-webinar-${lesson.id}`} /><Label htmlFor={`type-webinar-${lesson.id}`}>Webinar</Label></div>
                                                   </RadioGroup>
                                               </div>
                                                <div>
                                                    <Label htmlFor={`res-title-${lesson.id}`}>Resource Title</Label>
                                                    <Input id={`res-title-${lesson.id}`} value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g., Chapter 1 PDF" disabled={isSubmitting} />
                                                </div>
                                                <div>
                                                    <Label htmlFor={`res-content-${lesson.id}`}>{resourceType === 'note' ? 'Content' : 'URL'}</Label>
                                                    <Textarea id={`res-content-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder={resourceType === 'note' ? 'Enter text content...' : 'Enter full URL...'} disabled={isSubmitting} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button type="submit" disabled={isSubmitting}>
                                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Add Resource
                                                    </Button>
                                                    <Button type="button" variant="outline" onClick={() => setIsResourceFormOpen(null)} disabled={isSubmitting}>Cancel</Button>
                                                </div>
                                           </form>
                                       </CardContent>
                                   </Card>
                               ) : (
                                  <Button size="sm" variant="outline" className="mt-4" onClick={() => openResourceForm(lesson.id)} disabled={isSubmitting}>
                                    <PlusCircle className="mr-2 h-4 w-4"/> Add Resource to this Lesson
                                  </Button>
                               )}

                                <div className="border-t mt-4 pt-4">
                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteLesson(lesson.id)} disabled={isSubmitting}>
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete Entire Lesson
                                    </Button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>

            {isLessonFormOpen ? (
                <Card className="mt-4">
                    <CardHeader><CardTitle className="text-base">Add New Lesson</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddLesson} className="flex items-end gap-2">
                            <div className="flex-grow">
                                <Label htmlFor="new-lesson-title">Lesson Title</Label>
                                <Input id="new-lesson-title" value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} placeholder="e.g., Week 1: Introduction" disabled={isSubmitting} />
                            </div>
                            <Button type="submit" disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4"/> Save Lesson</Button>
                            <Button type="button" variant="ghost" onClick={() => setIsLessonFormOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <Button className="mt-4" onClick={() => setIsLessonFormOpen(true)} disabled={isSubmitting}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add a New Lesson
                </Button>
            )}

        </CardContent>
        <CardFooter>
             <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} disabled={isSubmitting}>
                Back to All Courses
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
