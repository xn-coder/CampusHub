
"use client";

import { useState, useEffect, type FormEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users as WebinarIcon, Loader2, GripVertical, FileQuestion, ArrowLeft } from 'lucide-react';
import type { Course, CourseResource, LessonContentResource, CourseResourceType, QuizQuestion, UserRole } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { 
  getCourseContentForAdminAction,
  addLessonToCourseAction,
  deleteCourseResourceAction,
  updateLessonContentAction,
  createSignedUploadUrlAction, 
  addResourceToLessonAction,
  getAllCoursesForAdminNavAction,
} from '../../actions';
import { supabase } from '@/lib/supabaseClient';
import { Progress } from '@/components/ui/progress';

type ResourceTabKey = 'note' | 'video' | 'ebook' | 'webinar' | 'quiz';

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
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([{ id: uuidv4(), question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  const resourceFormRef = useRef<HTMLFormElement>(null);

  const fetchCourseData = async () => {
    setIsLoading(true);
    const result = await getCourseContentForAdminAction(courseId);
    if (result.ok) {
      setCourse(result.course || null);
      setLessons(result.resources?.filter(r => r.type === 'note' && r.url_or_content?.startsWith('[')) || []);
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
  }, [courseId, router, toast]);
  
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
    setResourceFile(null);
    setQuizQuestions([{ id: uuidv4(), question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setResourceFile(file);
    if (file) setResourceUrlOrContent(''); 
  };
  
  const handleAddResourceToLesson = async (e: FormEvent, lesson: CourseResource) => {
    e.preventDefault();
    if (!resourceTitle.trim()) {
      toast({title: "Error", description: "Resource title is required.", variant: "destructive"});
      return;
    }
    
    const isFileRequired = resourceType === 'video' || resourceType === 'ebook';
    const isUrlOrTextRequired = resourceType === 'note' || resourceType === 'webinar';
    if (isFileRequired && !resourceFile && !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "A file upload or a URL is required for this resource type.", variant: "destructive" });
      return;
    }
    if(isUrlOrTextRequired && !resourceUrlOrContent.trim()){
      toast({ title: "Error", description: "Content is required for this resource type.", variant: "destructive" });
      return;
    }
    if (resourceType === 'quiz' && quizQuestions.some(q => !q.question.trim() || q.options.some(o => !o.trim()))) {
      toast({ title: "Error", description: "Please fill out all question and option fields for the quiz.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let finalUrlOrContent = resourceUrlOrContent;

      if (resourceFile) {
        toast({title:"Preparing to upload file..."});
        const signedUrlResult = await createSignedUploadUrlAction(
          courseId,
          resourceFile.name,
          resourceFile.type
        );

        if (!signedUrlResult.ok || !signedUrlResult.signedUrl) {
          throw new Error(signedUrlResult.message || 'Failed to prepare upload.');
        }

        toast({title:"Starting upload... this may take a while."});
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrlResult.signedUrl!, true);
          xhr.setRequestHeader('Content-Type', resourceFile.type);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              let errorMessage = `Upload failed with status ${xhr.status}`;
              if (xhr.statusText) {
                errorMessage += ` - ${xhr.statusText}`;
              }
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                if (errorResponse.message) {
                  errorMessage += `: ${errorResponse.message}`;
                }
              } catch (e) {
                // Not a JSON response
              }
              reject(new Error(errorMessage));
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload. Please check your internet connection.'));
          xhr.send(resourceFile);
        });

        finalUrlOrContent = signedUrlResult.publicUrl!;
        toast({title:"File upload complete!"});
      } else if (resourceType === 'quiz') {
        finalUrlOrContent = JSON.stringify(quizQuestions);
      }

      const formData = new FormData();
      formData.append('lessonId', lesson.id);
      formData.append('courseId', courseId);
      formData.append('resourceTitle', resourceTitle);
      formData.append('resourceType', resourceType);
      formData.append('urlOrContent', finalUrlOrContent);
      
      const result = await addResourceToLessonAction(formData);

      if (result.ok) {
          toast({title: "Resource Added"});
          setIsResourceFormOpen(null);
          resourceFormRef.current?.reset();
          await fetchCourseData();
      } else {
          throw new Error(result.message);
      }
    } catch (error: any) {
      toast({title: "Error", description: error.message, variant: "destructive"});
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };


  const handleDeleteResourceFromLesson = async (lesson: CourseResource, contentId: string) => {
     if (!confirm("Are you sure you want to delete this resource?")) return;
     
     setIsSubmitting(true);
     const result = await deleteCourseResourceAction(contentId);
     if (result.ok) {
        toast({title: "Resource Deleted", variant: "destructive"});
        await fetchCourseData();
     } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
     }
     setIsSubmitting(false);
  };
  
  const handleAddQuizQuestion = () => {
    setQuizQuestions(prev => [...prev, { id: uuidv4(), question: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const handleQuizQuestionChange = (index: number, value: string) => {
    const newQuestions = [...quizQuestions];
    newQuestions[index].question = value;
    setQuizQuestions(newQuestions);
  };
  
  const handleQuizOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...quizQuestions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuizQuestions(newQuestions);
  };
  
  const handleCorrectAnswerChange = (qIndex: number, oIndex: number) => {
    const newQuestions = [...quizQuestions];
    newQuestions[qIndex].correctAnswerIndex = oIndex;
    setQuizQuestions(newQuestions);
  };

  const handleRemoveQuizQuestion = (index: number) => {
    if (quizQuestions.length > 1) {
      const newQuestions = quizQuestions.filter((_, i) => i !== index);
      setQuizQuestions(newQuestions);
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/> <span className="ml-2">Loading course details...</span></div>;
  }
  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found. It might have been deleted.</div>;
  }

  const getResourceIcon = (type: string) => {
    const props = { className: "mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" };
    switch(type) {
      case 'ebook': return <BookOpen {...props} />;
      case 'video': return <Video {...props} />;
      case 'note': return <FileText {...props} />;
      case 'webinar': return <WebinarIcon {...props} />;
      case 'quiz': return <FileQuestion {...props} />;
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
                                           <div className="flex items-center min-w-0">
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
                                           <form ref={resourceFormRef} onSubmit={(e) => handleAddResourceToLesson(e, lesson)} className="space-y-4">
                                                <div>
                                                   <Label>Resource Type</Label>
                                                   <RadioGroup value={resourceType} onValueChange={(val) => setResourceType(val as ResourceTabKey)} className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="note" id={`type-note-${lesson.id}`} /><Label htmlFor={`type-note-${lesson.id}`}>Note</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="video" id={`type-video-${lesson.id}`} /><Label htmlFor={`type-video-${lesson.id}`}>Video</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="ebook" id={`type-ebook-${lesson.id}`} /><Label htmlFor={`type-ebook-${lesson.id}`}>E-book</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="webinar" id={`type-webinar-${lesson.id}`} /><Label htmlFor={`type-webinar-${lesson.id}`}>Webinar</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="quiz" id={`type-quiz-${lesson.id}`} /><Label htmlFor={`type-quiz-${lesson.id}`}>Quiz</Label></div>
                                                   </RadioGroup>
                                                </div>
                                                <div>
                                                    <Label htmlFor={`res-title-${lesson.id}`}>Resource Title</Label>
                                                    <Input id={`res-title-${lesson.id}`} value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g., Chapter 1 PDF" required disabled={isSubmitting} />
                                                </div>

                                                {resourceType === 'quiz' ? (
                                                  <div className="space-y-4 p-4 border bg-background rounded-md">
                                                    <Label className="text-lg">Quiz Builder</Label>
                                                      {quizQuestions.map((q, qIndex) => (
                                                          <div key={q.id} className="p-3 border rounded-lg space-y-3 bg-muted/50">
                                                              <div className="flex justify-between items-center">
                                                                  <Label htmlFor={`q-text-${q.id}`}>Question {qIndex + 1}</Label>
                                                                  {quizQuestions.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuizQuestion(qIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                                              </div>
                                                              <Textarea id={`q-text-${q.id}`} value={q.question} onChange={e => handleQuizQuestionChange(qIndex, e.target.value)} placeholder="Enter the question text" disabled={isSubmitting}/>
                                                              <div className="space-y-2">
                                                                <Label>Options (select the correct answer)</Label>
                                                                <RadioGroup value={String(q.correctAnswerIndex)} onValueChange={val => handleCorrectAnswerChange(qIndex, Number(val))}>
                                                                    {q.options.map((opt, oIndex) => (
                                                                        <div key={oIndex} className="flex items-center space-x-2">
                                                                            <RadioGroupItem value={String(oIndex)} id={`q${qIndex}-o${oIndex}`} />
                                                                            <Input value={opt} onChange={e => handleQuizOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} disabled={isSubmitting}/>
                                                                        </div>
                                                                    ))}
                                                                </RadioGroup>
                                                              </div>
                                                          </div>
                                                      ))}
                                                      <Button type="button" variant="outline" size="sm" onClick={handleAddQuizQuestion}>Add Another Question</Button>
                                                  </div>
                                                ) : resourceType === 'note' ? (
                                                   <div>
                                                      <Label htmlFor={`res-content-${lesson.id}`}>Content</Label>
                                                      <Textarea id={`res-content-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder='Enter text content...' required disabled={isSubmitting} />
                                                  </div>
                                                ) : resourceType === 'webinar' ? (
                                                  <div>
                                                      <Label htmlFor={`res-content-${lesson.id}`}>Webinar URL</Label>
                                                      <Input id={`res-content-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder='https://...' type="url" required disabled={isSubmitting} />
                                                  </div>
                                                ) : resourceType === 'video' || resourceType === 'ebook' ? (
                                                  <div className="space-y-4">
                                                      <div>
                                                          <Label htmlFor={`res-url-${lesson.id}`}>URL (Optional)</Label>
                                                          <Input id={`res-url-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder="Or provide a direct URL" disabled={isSubmitting || !!resourceFile}/>
                                                      </div>
                                                      <div className="relative flex py-2 items-center justify-center text-sm text-muted-foreground">
                                                          <div className="flex-grow border-t"></div><span className="flex-shrink mx-4">OR</span><div className="flex-grow border-t"></div>
                                                      </div>
                                                      <div>
                                                          <Label htmlFor={`res-file-${lesson.id}`}>Upload File</Label>
                                                          <Input id={`res-file-${lesson.id}`} type="file" onChange={handleFileChange} disabled={isSubmitting} />
                                                          <p className="text-xs text-muted-foreground mt-1">If you upload a file, it will be used instead of the URL.</p>
                                                      </div>
                                                  </div>
                                                ) : null }
                                                
                                                {isSubmitting && uploadProgress > 0 && (
                                                  <div className="space-y-2">
                                                    <Label>Uploading...</Label>
                                                    <Progress value={uploadProgress} />
                                                  </div>
                                                )}

                                                <div className="flex gap-2 pt-4">
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
                                <Input id="new-lesson-title" value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} placeholder="e.g., Week 1: Introduction" required disabled={isSubmitting} />
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
