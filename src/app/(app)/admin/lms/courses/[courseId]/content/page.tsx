

"use client";

import { useState, useEffect, type FormEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users as WebinarIcon, Loader2, GripVertical, FileQuestion, ArrowLeft, Presentation, Edit2, BookCopy, Music, MousePointerSquareDashed, ListVideo, Clock, ImageIcon, Heading2, User as ProfileIcon, Instagram, Facebook, Twitter, Linkedin, Phone, Mail, Link2, MapPin } from 'lucide-react';
import type { Course, CourseResource, LessonContentResource, CourseResourceType, QuizQuestion, UserRole, DNDTemplateType, DNDCategorizationItem, DNDCategory, DNDMatchingItem, DNDSequencingItem, WebPageSection, WebPageSectionType, WebPageTemplate, WebPageContent } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { 
  getCourseContentForAdminAction,
  addLessonToCourseAction,
  deleteCourseResourceAction,
  updateResourceInLessonAction,
  createSignedUploadUrlAction, 
  addResourceToLessonAction,
} from '../../actions';
import { supabase } from '@/lib/supabaseClient';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@/components/shared/ck-editor'), { 
    ssr: false,
    loading: () => <div className="space-y-2 rounded-md border p-4"><Skeleton className="h-7 w-full" /><Skeleton className="h-20 w-full" /></div>
});

type ResourceTabKey = 'note' | 'video' | 'ebook' | 'webinar' | 'quiz' | 'ppt' | 'audio' | 'drag_and_drop' | 'youtube_playlist' | 'web_page';

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  const [isResourceFormOpen, setIsResourceFormOpen] = useState<string | null>(null); // Holds lesson ID
  const [editingResource, setEditingResource] = useState<LessonContentResource | null>(null); // Holds resource being edited
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceTabKey>('note');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');


  // Note (multi-page) state
  const [notePages, setNotePages] = useState<string[]>(['']);
  
  // Web Page Builder State
  const [webPageTemplate, setWebPageTemplate] = useState<WebPageTemplate>('default');
  const [webPageSections, setWebPageSections] = useState<WebPageSection[]>([]);
  const [sectionImageFiles, setSectionImageFiles] = useState<Record<string, File | null>>({});
  const [profileCardData, setProfileCardData] = useState<WebPageContent['profileCardData']>({});
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([{ id: uuidv4(), question: '', options: ['', '', '', ''], questionType: 'single', correctAnswers: [] }]);
  const resourceFormRef = useRef<HTMLFormElement>(null);

  // DND State
  const [dndTemplate, setDndTemplate] = useState<DNDTemplateType>('categorization');
  const [dndInstructions, setDndInstructions] = useState('');
  const [dndCategorizationItems, setDndCategorizationItems] = useState<DNDCategorizationItem[]>([]);
  const [dndCategories, setDndCategories] = useState<DNDCategory[]>([]);
  const [dndMatchingItems, setDndMatchingItems] = useState<DNDMatchingItem[]>([{ id: uuidv4(), prompt: '', match: '' }]);
  const [dndSequencingItems, setDndSequencingItems] = useState<DNDSequencingItem[]>([{ id: uuidv4(), content: '' }]);

  useEffect(() => {
    const role = localStorage.getItem('currentUserRole') as UserRole | null;
    setCurrentUserRole(role);
  }, []);

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
  
  const handleDeleteResource = async (lesson: CourseResource, resourceId: string) => {
     if (!confirm("Are you sure you want to delete this resource? This cannot be undone.")) return;
     
     setIsSubmitting(true);
     const currentContent: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[];
     const updatedContent = currentContent.filter(res => res.id !== resourceId);

     const result = await deleteCourseResourceAction(lesson.id, updatedContent);

     if (result.ok) {
        toast({title: "Resource Deleted", variant: "destructive"});
        await fetchCourseData();
     } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
     }
     setIsSubmitting(false);
  };
  
  const handleOpenResourceForm = (lessonId: string, resourceToEdit?: LessonContentResource) => {
    setIsResourceFormOpen(lessonId);
    setEditingResource(resourceToEdit || null);
    
    // Reset all form states first
    setResourceTitle(''); setResourceType('note'); setResourceUrlOrContent('');
    setDurationMinutes('');
    setNotePages(['']);
    setWebPageTemplate('default'); setWebPageSections([]);
    setSectionImageFiles({});
    setProfileCardData({});
    setProfileImageFile(null);
    setBannerImageFile(null);
    setQuizQuestions([{ id: uuidv4(), question: '', options: ['', '', '', ''], questionType: 'single', correctAnswers: [] }]);
    setDndTemplate('categorization'); setDndInstructions(''); setDndCategorizationItems([]); setDndCategories([]);
    setDndMatchingItems([{ id: uuidv4(), prompt: '', match: '' }]);
    setDndSequencingItems([{ id: uuidv4(), content: '' }]);

    if (resourceToEdit) {
      setResourceTitle(resourceToEdit.title);
      setResourceType(resourceToEdit.type as ResourceTabKey);
      setDurationMinutes(resourceToEdit.duration_minutes ?? '');

      if (resourceToEdit.type === 'quiz') {
        const loadedQuestions: QuizQuestion[] = JSON.parse(resourceToEdit.url_or_content || '[]') || [];
        const migratedQuestions = loadedQuestions.map(q => {
            if (q.correctAnswerIndex !== undefined && q.correctAnswers === undefined) {
                return { ...q, questionType: 'single', correctAnswers: [q.correctAnswerIndex] };
            }
            return { ...q, questionType: q.questionType || 'single', correctAnswers: q.correctAnswers || [] };
        });
        setQuizQuestions(migratedQuestions.length > 0 ? migratedQuestions : [{ id: uuidv4(), question: '', options: ['', '', '', ''], questionType: 'single', correctAnswers: [] }]);
      } else if (resourceToEdit.type === 'note' && resourceToEdit.url_or_content.startsWith('[')) {
        setNotePages(JSON.parse(resourceToEdit.url_or_content));
      } else if (resourceToEdit.type === 'web_page') {
        const pageContent: WebPageContent = JSON.parse(resourceToEdit.url_or_content || '{}');
        setWebPageTemplate(pageContent.template || 'default');
        setWebPageSections(pageContent.sections || []);
        setProfileCardData(pageContent.profileCardData || {});
      } else if (resourceToEdit.type === 'drag_and_drop') {
          const dndData = JSON.parse(resourceToEdit.url_or_content || '{}');
          setDndTemplate(dndData.template || 'categorization');
          setDndInstructions(dndData.instructions || '');
          setDndCategorizationItems(dndData.categorizationItems || []);
          setDndCategories(dndData.categories || []);
          setDndMatchingItems(dndData.matchingItems || [{ id: uuidv4(), prompt: '', match: '' }]);
          setDndSequencingItems(dndData.sequencingItems || [{ id: uuidv4(), content: '' }]);
      } else {
        setResourceUrlOrContent(resourceToEdit.url_or_content);
      }
    }
    setResourceFile(null);
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setResourceFile(file);
    if (file) setResourceUrlOrContent(''); 
  };
  
  const handleResourceSubmit = async (e: FormEvent, lesson: CourseResource) => {
    e.preventDefault();
    if (!resourceTitle.trim()) {
      toast({title: "Error", description: "Resource title is required.", variant: "destructive"});
      return;
    }
    
    // --- Validation Section ---
    const isFileRequired = ['video', 'ebook', 'ppt', 'audio'].includes(resourceType);
    if (isFileRequired && !resourceFile && !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "A file upload or a URL is required for this resource type.", variant: "destructive" });
      return;
    }
    if ((resourceType === 'webinar' || resourceType === 'youtube_playlist') && !resourceUrlOrContent.trim()){
      toast({ title: "Error", description: "Content is required for this resource type.", variant: "destructive" });
      return;
    }
    if (resourceType === 'quiz' && (quizQuestions.some(q => !q.question.trim() || q.options.some(o => !o.trim())) || quizQuestions.some(q => q.correctAnswers.length === 0)) ) {
      toast({ title: "Error", description: "Please fill out all question/option fields and select at least one correct answer for each question.", variant: "destructive" });
      return;
    }
    if (resourceType === 'note' && notePages.some(p => !p.trim())) {
      toast({ title: "Error", description: "Note pages cannot be empty.", variant: "destructive" });
      return;
    }
    if (resourceType === 'drag_and_drop') {
        if (!dndInstructions.trim()) {
            toast({ title: "Error", description: "Instructions are required for Drag & Drop activities.", variant: "destructive"}); return;
        }
        if (dndTemplate === 'categorization' && (dndCategories.length === 0 || dndCategorizationItems.length === 0)) {
            toast({ title: "Error", description: "For Categorization, at least one category and one item are required.", variant: "destructive"}); return;
        }
        if (dndTemplate === 'matching' && dndMatchingItems.some(p => !p.prompt.trim() || !p.match.trim())) {
            toast({ title: "Error", description: "For Matching Pairs, all prompts and matches must be filled.", variant: "destructive"}); return;
        }
        if (dndTemplate === 'sequencing' && dndSequencingItems.some(item => !item.content.trim())) {
            toast({ title: "Error", description: "For Sequencing, all item content fields must be filled.", variant: "destructive"}); return;
        }
    }


    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let finalUrlOrContent = resourceUrlOrContent;

      if (resourceFile) {
        toast({title:"Preparing to upload file..."});
        const signedUrlResult = await createSignedUploadUrlAction(courseId, resourceFile.name, resourceFile.type);
        if (!signedUrlResult.ok || !signedUrlResult.signedUrl) throw new Error(signedUrlResult.message || 'Failed to prepare upload.');

        toast({title:"Starting upload... this may take a while."});
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrlResult.signedUrl!, true);
          xhr.setRequestHeader('Content-Type', resourceFile.type);
          xhr.upload.onprogress = (event) => setUploadProgress(event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : 0);
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Upload failed'));
          xhr.onerror = () => reject(new Error('Network error during upload.'));
          xhr.send(resourceFile);
        });

        finalUrlOrContent = signedUrlResult.publicUrl!;
        toast({title:"File upload complete!"});
      } else if (resourceType === 'quiz') {
        finalUrlOrContent = JSON.stringify(quizQuestions);
      } else if (resourceType === 'note') {
        finalUrlOrContent = JSON.stringify(notePages);
      } else if (resourceType === 'web_page') {
        const uploadedProfileCardData = { ...profileCardData };
        if (profileImageFile) {
            const result = await createSignedUploadUrlAction(courseId, profileImageFile.name, profileImageFile.type);
            if (!result.ok) throw new Error(result.message);
            await fetch(result.signedUrl!, { method: 'PUT', body: profileImageFile, headers: { 'Content-Type': profileImageFile.type } });
            uploadedProfileCardData.profileImageUrl = result.publicUrl;
        }
        if (bannerImageFile) {
            const result = await createSignedUploadUrlAction(courseId, bannerImageFile.name, bannerImageFile.type);
            if (!result.ok) throw new Error(result.message);
            await fetch(result.signedUrl!, { method: 'PUT', body: bannerImageFile, headers: { 'Content-Type': bannerImageFile.type } });
            uploadedProfileCardData.bannerImageUrl = result.publicUrl;
        }
        
         const uploadedSections = [...webPageSections];
         for (let i = 0; i < webPageSections.length; i++) {
             const section = webPageSections[i];
             const fileToUpload = sectionImageFiles[section.id];
             if (section.type === 'image' && fileToUpload) {
                 const signedUrlResult = await createSignedUploadUrlAction(courseId, fileToUpload.name, fileToUpload.type);
                 if (!signedUrlResult.ok || !signedUrlResult.signedUrl) throw new Error(`Image upload failed for section ${i + 1}.`);
                 
                 await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('PUT', signedUrlResult.signedUrl!, true);
                    xhr.setRequestHeader('Content-Type', fileToUpload.type);
                    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Image upload failed'));
                    xhr.send(fileToUpload);
                });
                 
                 uploadedSections[i].content = signedUrlResult.publicUrl!;
             }
         }
         finalUrlOrContent = JSON.stringify({ template: webPageTemplate, sections: uploadedSections, profileCardData: uploadedProfileCardData });
      } else if (resourceType === 'drag_and_drop') {
          const dndData = {
              template: dndTemplate,
              title: resourceTitle.trim(),
              instructions: dndInstructions,
              // Only include the data for the selected template
              ...(dndTemplate === 'categorization' && { categories: dndCategories, categorizationItems: dndCategorizationItems }),
              ...(dndTemplate === 'matching' && { matchingItems: dndMatchingItems }),
              ...(dndTemplate === 'sequencing' && { sequencingItems: dndSequencingItems }),
          };
          finalUrlOrContent = JSON.stringify(dndData);
      }
      
      let result;
      const resourceData: LessonContentResource = {
        id: editingResource?.id || uuidv4(),
        type: resourceType,
        title: resourceTitle.trim(),
        url_or_content: finalUrlOrContent,
        duration_minutes: durationMinutes !== '' ? Number(durationMinutes) : undefined,
      };

      if (editingResource) {
        result = await updateResourceInLessonAction(lesson.id, editingResource.id, resourceData);
      } else {
        const formData = new FormData();
        formData.append('lessonId', lesson.id);
        formData.append('courseId', courseId);
        formData.append('resourceTitle', resourceData.title);
        formData.append('resourceType', resourceData.type);
        formData.append('urlOrContent', resourceData.url_or_content);
        if (resourceData.duration_minutes) {
            formData.append('duration_minutes', String(resourceData.duration_minutes));
        }
        result = await addResourceToLessonAction(formData);
      }


      if (result.ok) {
          toast({title: editingResource ? "Resource Updated" : "Resource Added"});
          setIsResourceFormOpen(null);
          setEditingResource(null);
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


  const handleDeleteLesson = async (lessonId: string) => {
     if (confirm("Are you sure you want to delete this entire lesson and all its contents? This cannot be undone.")) {
       setIsSubmitting(true);
       const result = await deleteCourseResourceAction(lessonId);
       if (result.ok) {
          toast({title: "Lesson Deleted", variant: "destructive"});
          await fetchCourseData();
       } else {
          toast({title: "Error", description: result.message, variant: "destructive"});
       }
       setIsSubmitting(false);
     }
  };
  
  // --- Note Page Handlers ---
  const handleAddNotePage = () => setNotePages(prev => [...prev, '']);
  const handleNotePageChange = (index: number, data: string) => {
      const newPages = [...notePages];
      newPages[index] = data;
      setNotePages(newPages);
  };
  const handleRemoveNotePage = (index: number) => {
      if (notePages.length > 1) {
          setNotePages(prev => prev.filter((_, i) => i !== index));
      }
  };

  // --- Web Page Section Handlers ---
    const handleAddWebPageSection = (type: WebPageSectionType) => {
        setWebPageSections(prev => [...prev, { id: uuidv4(), type, content: '' }]);
    };
    const handleWebPageSectionContentChange = (index: number, content: string) => {
        const newSections = [...webPageSections];
        newSections[index].content = content;
        setWebPageSections(newSections);
    };
    const handleWebPageSectionImageChange = (index: number, file: File | null) => {
        const sectionId = webPageSections[index].id;
        setSectionImageFiles(prev => ({ ...prev, [sectionId]: file }));
    };
    const handleRemoveWebPageSection = (index: number) => {
        const sectionId = webPageSections[index].id;
        setWebPageSections(prev => prev.filter((_, i) => i !== index));
        setSectionImageFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[sectionId];
            return newFiles;
        });
    };
    const handleProfileCardDataChange = (field: keyof NonNullable<WebPageContent['profileCardData']>, value: string) => {
        setProfileCardData(prev => ({ ...prev, [field]: value }));
    };


  // --- Quiz Handlers ---
    const handleAddQuizQuestion = () => {
        setQuizQuestions(prev => [...prev, { id: uuidv4(), question: '', options: ['', '', '', ''], questionType: 'single', correctAnswers: [] }]);
    };

    const handleQuizQuestionChange = (index: number, field: 'question' | 'questionType', value: string) => {
        setQuizQuestions(prev => {
            const newQuestions = [...prev];
            const questionToUpdate = { ...newQuestions[index] };

            if (field === 'questionType') {
                questionToUpdate.questionType = value as 'single' | 'multiple';
                questionToUpdate.correctAnswers = []; // Reset correct answers when type changes
            } else {
                questionToUpdate.question = value;
            }
            newQuestions[index] = questionToUpdate;
            return newQuestions;
        });
    };

    const handleQuizOptionChange = (qIndex: number, oIndex: number, value: string) => {
        setQuizQuestions(prev => {
            const newQuestions = [...prev];
            newQuestions[qIndex].options[oIndex] = value;
            return newQuestions;
        });
    };

    const handleCorrectAnswerChange = (qIndex: number, oIndex: number, isChecked: boolean | 'indeterminate') => {
        setQuizQuestions(prev => {
            const newQuestions = [...prev];
            const question = newQuestions[qIndex];
            const currentAnswers = new Set(question.correctAnswers);

            if (question.questionType === 'single') {
                newQuestions[qIndex].correctAnswers = [oIndex];
            } else { // multiple
                if (isChecked) {
                    currentAnswers.add(oIndex);
                } else {
                    currentAnswers.delete(oIndex);
                }
                newQuestions[qIndex].correctAnswers = Array.from(currentAnswers);
            }
            return newQuestions;
        });
    };

    const handleRemoveQuizQuestion = (index: number) => {
        if (quizQuestions.length > 1) {
            setQuizQuestions(prev => prev.filter((_, i) => i !== index));
        }
    };


  // --- DND Handlers ---
  const handleAddCategory = () => setDndCategories(prev => [...prev, { id: uuidv4(), title: '' }]);
  const handleCategoryChange = (index: number, value: string) => {
      const newCategories = [...dndCategories];
      newCategories[index].title = value;
      setDndCategories(newCategories);
  };
  const handleRemoveCategory = (index: number) => {
      const categoryToRemove = dndCategories[index];
      setDndCategories(prev => prev.filter((_, i) => i !== index));
      setDndCategorizationItems(prev => prev.filter(item => item.category !== categoryToRemove.id));
  };

  const handleAddCategorizationItem = () => setDndCategorizationItems(prev => [...prev, { id: uuidv4(), content: '', category: '' }]);
  const handleCategorizationItemChange = (index: number, field: 'content' | 'category', value: string) => {
      const newItems = [...dndCategorizationItems];
      newItems[index][field] = value;
      setDndCategorizationItems(newItems);
  };
  const handleRemoveCategorizationItem = (index: number) => setDndCategorizationItems(prev => prev.filter((_, i) => i !== index));
  
  const handleAddMatchingPair = () => setDndMatchingItems(prev => [...prev, {id: uuidv4(), prompt: '', match: ''}]);
  const handleMatchingItemChange = (index: number, field: 'prompt'|'match', value: string) => {
      const newItems = [...dndMatchingItems];
      newItems[index][field] = value;
      setDndMatchingItems(newItems);
  };
  const handleRemoveMatchingPair = (index: number) => {
      if(dndMatchingItems.length > 1) setDndMatchingItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleAddSequencingItem = () => setDndSequencingItems(prev => [...prev, {id: uuidv4(), content: ''}]);
  const handleSequencingItemChange = (index: number, value: string) => {
      const newItems = [...dndSequencingItems];
      newItems[index].content = value;
      setDndSequencingItems(newItems);
  };
  const handleRemoveSequencingItem = (index: number) => {
      if(dndSequencingItems.length > 1) setDndSequencingItems(prev => prev.filter((_, i) => i !== index));
  };

  const isSuperAdmin = currentUserRole === 'superadmin';

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
      case 'ppt': return <Presentation {...props} />;
      case 'audio': return <Music {...props} />;
      case 'drag_and_drop': return <MousePointerSquareDashed {...props} />;
      case 'youtube_playlist': return <ListVideo {...props} />;
      case 'web_page': return <ImageIcon {...props} />;
      default: return null;
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description={isSuperAdmin ? "Add lessons and organize your course resources." : "Preview of the course structure."} />
      
      <Card>
        <CardHeader>
            <CardTitle>Course Structure</CardTitle>
            <CardDescription>{isSuperAdmin ? "Add, remove, and manage lessons for this course." : "Below are the lessons and resources included in this course."}</CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                {lessons.map(lesson => {
                    const lessonContents: LessonContentResource[] = JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[];
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
                                                {res.duration_minutes && <Clock className="h-3 w-3 text-muted-foreground ml-2 shrink-0" />}
                                           </div>
                                            {isSuperAdmin && (
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenResourceForm(lesson.id, res)} disabled={isSubmitting}>
                                                        <Edit2 className="h-4 w-4"/>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteResource(lesson, res.id)} disabled={isSubmitting}>
                                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                                    </Button>
                                                </div>
                                            )}
                                       </div>
                                   )) : <p className="text-sm text-muted-foreground text-center py-2">No resources in this lesson yet.</p>}
                               </div>
                               
                               {isResourceFormOpen === lesson.id ? (
                                   <Card className="mt-4 bg-muted/50">
                                       <CardHeader><CardTitle className="text-base">{editingResource ? `Edit Resource in "${lesson.title}"` : `Add New Resource to "${lesson.title}"`}</CardTitle></CardHeader>
                                       <CardContent>
                                           <form ref={resourceFormRef} onSubmit={(e) => handleResourceSubmit(e, lesson)} className="space-y-4">
                                                <div>
                                                   <Label>Resource Type</Label>
                                                   <RadioGroup value={resourceType} onValueChange={(val) => setResourceType(val as ResourceTabKey)} className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="note" id={`type-note-${lesson.id}`} /><Label htmlFor={`type-note-${lesson.id}`}>Note</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="web_page" id={`type-webpage-${lesson.id}`} /><Label htmlFor={`type-webpage-${lesson.id}`}>Web Page</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="video" id={`type-video-${lesson.id}`} /><Label htmlFor={`type-video-${lesson.id}`}>Video</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="youtube_playlist" id={`type-yt-playlist-${lesson.id}`} /><Label htmlFor={`type-yt-playlist-${lesson.id}`}>YouTube Playlist</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="audio" id={`type-audio-${lesson.id}`} /><Label htmlFor={`type-audio-${lesson.id}`}>Audio</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="ebook" id={`type-ebook-${lesson.id}`} /><Label htmlFor={`type-ebook-${lesson.id}`}>E-book/PDF</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="ppt" id={`type-ppt-${lesson.id}`} /><Label htmlFor={`type-ppt-${lesson.id}`}>PPT</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="webinar" id={`type-webinar-${lesson.id}`} /><Label htmlFor={`type-webinar-${lesson.id}`}>Webinar Link</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="quiz" id={`type-quiz-${lesson.id}`} /><Label htmlFor={`type-quiz-${lesson.id}`}>Quiz</Label></div>
                                                       <div className="flex items-center space-x-2"><RadioGroupItem value="drag_and_drop" id={`type-dnd-${lesson.id}`} /><Label htmlFor={`type-dnd-${lesson.id}`}>Drag &amp; Drop</Label></div>
                                                   </RadioGroup>
                                                </div>
                                                <div className="grid md:grid-cols-2 gap-4">
                                                  <div>
                                                      <Label htmlFor={`res-title-${lesson.id}`}>Resource Title</Label>
                                                      <Input id={`res-title-${lesson.id}`} value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g., Chapter 1 PDF" required disabled={isSubmitting} />
                                                  </div>
                                                  {['quiz', 'drag_and_drop'].includes(resourceType) && (
                                                    <div>
                                                        <Label htmlFor={`res-duration-${lesson.id}`}>Timer / Duration (in seconds)</Label>
                                                        <Input id={`res-duration-${lesson.id}`} type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value, 10))} placeholder="Optional, e.g., 600 for 10 mins" disabled={isSubmitting}/>
                                                    </div>
                                                  )}
                                                </div>

                                                {/* --- DYNAMIC FORM SECTION --- */}
                                                
                                                {resourceType === 'web_page' ? (
                                                     <div className="space-y-4 p-4 border bg-background rounded-md">
                                                        <Label className="text-lg">Web Page Builder</Label>
                                                         <div>
                                                            <Label>Template</Label>
                                                            <Select value={webPageTemplate} onValueChange={val => setWebPageTemplate(val as WebPageTemplate)}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="default">Default</SelectItem>
                                                                    <SelectItem value="article">Article Style</SelectItem>
                                                                    <SelectItem value="profile_card">Profile Card</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                             <div className="border rounded-md p-2 space-y-1 mt-2 bg-muted/50">
                                                                <p className="text-xs text-muted-foreground text-center mb-1">Template Preview</p>
                                                                {webPageTemplate === 'default' && (
                                                                    <div className="space-y-1"><div className="h-4 bg-muted-foreground/20 rounded-sm w-3/4"></div><div className="h-8 bg-muted-foreground/10 rounded-sm"></div><div className="h-10 bg-muted-foreground/20 rounded-sm w-1/2 mx-auto"></div><div className="h-8 bg-muted-foreground/10 rounded-sm"></div></div>
                                                                )}
                                                                {webPageTemplate === 'article' && (
                                                                    <div className="space-y-1"><div className="h-6 bg-muted-foreground/20 rounded-sm w-1/2 mx-auto mb-2"></div><div className="space-y-1"><div className="h-2 bg-muted-foreground/10 rounded-sm w-full"></div><div className="h-2 bg-muted-foreground/10 rounded-sm w-full"></div><div className="h-2 bg-muted-foreground/10 rounded-sm w-3/4"></div></div></div>
                                                                )}
                                                                {webPageTemplate === 'profile_card' && (
                                                                    <div className="flex flex-col items-center gap-1"><div className="h-8 w-full bg-primary/20 rounded-t-md"></div><div className="size-8 rounded-full bg-primary/40 -mt-4 border-2 border-muted"></div><div className="h-3 w-1/2 bg-muted-foreground/20 rounded-sm"></div><div className="h-2 w-1/3 bg-muted-foreground/10 rounded-sm"></div><div className="h-4 w-full bg-primary/20 rounded-b-md mt-1"></div></div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {webPageTemplate === 'profile_card' ? (
                                                            <div className="space-y-4">
                                                                <h4 className="font-semibold text-md border-b">Profile Card Content</h4>
                                                                <div className="grid md:grid-cols-2 gap-4">
                                                                    <div><Label>Name</Label><Input value={profileCardData?.name || ''} onChange={e => handleProfileCardDataChange('name', e.target.value)} /></div>
                                                                    <div><Label>Job Title</Label><Input value={profileCardData?.jobTitle || ''} onChange={e => handleProfileCardDataChange('jobTitle', e.target.value)} /></div>
                                                                    <div><Label>Profile Image</Label><Input type="file" accept="image/*" onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} /></div>
                                                                    <div><Label>Banner Image</Label><Input type="file" accept="image/*" onChange={(e) => setBannerImageFile(e.target.files?.[0] || null)} /></div>
                                                                    <div className="md:col-span-2"><Label>Description</Label><Input value={profileCardData?.description || ''} onChange={e => handleProfileCardDataChange('description', e.target.value)} /></div>
                                                                    <div><Label>Phone</Label><Input value={profileCardData?.phone || ''} onChange={e => handleProfileCardDataChange('phone', e.target.value)} /></div>
                                                                    <div><Label>WhatsApp</Label><Input value={profileCardData?.whatsapp || ''} onChange={e => handleProfileCardDataChange('whatsapp', e.target.value)} /></div>
                                                                    <div><Label>Email</Label><Input type="email" value={profileCardData?.email || ''} onChange={e => handleProfileCardDataChange('email', e.target.value)} /></div>
                                                                    <div><Label>Website</Label><Input type="url" value={profileCardData?.website || ''} onChange={e => handleProfileCardDataChange('website', e.target.value)} /></div>
                                                                    <div className="md:col-span-2"><Label>Address</Label><Input value={profileCardData?.address || ''} onChange={e => handleProfileCardDataChange('address', e.target.value)} /></div>
                                                                    <div><Label>Instagram Handle</Label><Input value={profileCardData?.instagram || ''} onChange={e => handleProfileCardDataChange('instagram', e.target.value)} placeholder="@username" /></div>
                                                                    <div><Label>Facebook URL</Label><Input type="url" value={profileCardData?.facebook || ''} onChange={e => handleProfileCardDataChange('facebook', e.target.value)} placeholder="https://facebook.com/..." /></div>
                                                                    <div><Label>Twitter Handle</Label><Input value={profileCardData?.twitter || ''} onChange={e => handleProfileCardDataChange('twitter', e.target.value)} placeholder="@username" /></div>
                                                                    <div><Label>LinkedIn URL</Label><Input type="url" value={profileCardData?.linkedin || ''} onChange={e => handleProfileCardDataChange('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." /></div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <h4 className="font-semibold text-md border-b">Page Sections</h4>
                                                                {webPageSections.map((section, index) => (
                                                                    <div key={section.id} className="p-3 border rounded-lg space-y-3 bg-muted/50 relative">
                                                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleRemoveWebPageSection(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                        {section.type === 'heading' && (
                                                                            <div><Label>Heading</Label><Input value={section.content} onChange={e => handleWebPageSectionContentChange(index, e.target.value)} placeholder="Enter heading text..." /></div>
                                                                        )}
                                                                        {section.type === 'text' && (
                                                                            <div><Label>Text Block</Label><div className="mt-1 prose prose-sm max-w-none dark:prose-invert [&_.ck-editor__main>.ck-editor__editable]:min-h-24 [&_.ck-editor__main>.ck-editor__editable]:bg-background [&_.ck-toolbar]:bg-muted [&_.ck-toolbar]:border-border [&_.ck-editor__main]:border-border [&_.ck-content]:text-foreground"><Editor value={section.content} onChange={data => handleWebPageSectionContentChange(index, data)} disabled={isSubmitting} /></div></div>
                                                                        )}
                                                                        {section.type === 'image' && (
                                                                            <div><Label>Image</Label><Input type="file" accept="image/*" onChange={e => handleWebPageSectionImageChange(index, e.target.files?.[0] || null)} />
                                                                            {section.content && !sectionImageFiles[section.id] && <img src={section.content} alt="Preview" className="mt-2 max-h-40 rounded" />}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                <div className="flex gap-2">
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddWebPageSection('heading')}><Heading2 className="mr-2 h-4 w-4"/>Add Heading</Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddWebPageSection('text')}><FileText className="mr-2 h-4 w-4"/>Add Text</Button>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => handleAddWebPageSection('image')}><ImageIcon className="mr-2 h-4 w-4"/>Add Image</Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                     </div>
                                                ) : resourceType === 'drag_and_drop' ? (
                                                    <div className="space-y-4 p-4 border bg-background rounded-md">
                                                        <Label className="text-lg">Drag &amp; Drop Activity Builder</Label>
                                                        <div><Label>Instructions</Label><Input value={dndInstructions} onChange={e => setDndInstructions(e.target.value)} placeholder="e.g., Match the capital to the country." /></div>
                                                        <div><Label>Template</Label>
                                                            <Select value={dndTemplate} onValueChange={(val) => setDndTemplate(val as DNDTemplateType)}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="matching">Matching Pairs</SelectItem>
                                                                    <SelectItem value="sequencing">Sequencing</SelectItem>
                                                                    <SelectItem value="categorization">Categorization</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {dndTemplate === 'categorization' && (
                                                            <div className="space-y-4 p-2 border rounded-md">
                                                                <div>
                                                                    <Label>Categories</Label>
                                                                    <div className="space-y-2">
                                                                        {dndCategories.map((cat, index) => (<div key={cat.id} className="flex gap-2"><Input value={cat.title} onChange={e => handleCategoryChange(index, e.target.value)} placeholder={`Category ${index+1}`} /><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCategory(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>))}
                                                                    </div>
                                                                    <Button type="button" variant="outline" size="sm" onClick={handleAddCategory} className="mt-2">Add Category</Button>
                                                                </div>
                                                                <div>
                                                                    <Label>Items</Label>
                                                                    <div className="space-y-2">
                                                                        {dndCategorizationItems.map((item, index) => (
                                                                            <div key={item.id} className="flex gap-2 items-center">
                                                                                <Input value={item.content} onChange={e => handleCategorizationItemChange(index, 'content', e.target.value)} placeholder={`Item ${index+1}`} />
                                                                                <Select value={item.category} onValueChange={val => handleCategorizationItemChange(index, 'category', val)}>
                                                                                    <SelectTrigger><SelectValue placeholder="Assign Category"/></SelectTrigger>
                                                                                    <SelectContent>{dndCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                                                                                </Select>
                                                                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCategorizationItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <Button type="button" variant="outline" size="sm" onClick={handleAddCategorizationItem} className="mt-2">Add Item</Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {dndTemplate === 'matching' && (
                                                            <div className="space-y-2 p-2 border rounded-md">
                                                                <Label>Matching Pairs</Label>
                                                                {dndMatchingItems.map((pair, index) => (
                                                                    <div key={pair.id} className="flex gap-2 items-center">
                                                                        <Input placeholder="Prompt" value={pair.prompt} onChange={e => handleMatchingItemChange(index, 'prompt', e.target.value)} />
                                                                        <Input placeholder="Correct Match" value={pair.match} onChange={e => handleMatchingItemChange(index, 'match', e.target.value)} />
                                                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMatchingPair(index)} disabled={dndMatchingItems.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                    </div>
                                                                ))}
                                                                <Button type="button" variant="outline" size="sm" onClick={handleAddMatchingPair} className="mt-2">Add Pair</Button>
                                                            </div>
                                                        )}
                                                        {dndTemplate === 'sequencing' && (
                                                            <div className="space-y-2 p-2 border rounded-md">
                                                                <Label>Sequencing Items (in correct order)</Label>
                                                                {dndSequencingItems.map((item, index) => (
                                                                    <div key={item.id} className="flex gap-2 items-center">
                                                                        <span className="font-bold">{index + 1}.</span>
                                                                        <Input placeholder="Item Content" value={item.content} onChange={e => handleSequencingItemChange(index, e.target.value)} />
                                                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSequencingItem(index)} disabled={dndSequencingItems.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                    </div>
                                                                ))}
                                                                <Button type="button" variant="outline" size="sm" onClick={handleAddSequencingItem} className="mt-2">Add Step</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : resourceType === 'quiz' ? (
                                                  <div className="space-y-4 p-4 border bg-background rounded-md">
                                                    <Label className="text-lg">Quiz Builder</Label>
                                                      {quizQuestions.map((q, qIndex) => (
                                                          <div key={q.id} className="p-3 border rounded-lg space-y-3 bg-muted/50">
                                                              <div className="flex justify-between items-center">
                                                                  <Label htmlFor={`q-text-${q.id}`}>Question {qIndex + 1}</Label>
                                                                  {quizQuestions.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuizQuestion(qIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                                              </div>
                                                              <Input id={`q-text-${q.id}`} value={q.question} onChange={e => handleQuizQuestionChange(qIndex, 'question', e.target.value)} placeholder="Enter the question text" disabled={isSubmitting}/>
                                                              
                                                              <div>
                                                                  <Label className="text-xs">Answer Type</Label>
                                                                  <RadioGroup value={q.questionType} onValueChange={(val) => handleQuizQuestionChange(qIndex, 'questionType', val)} className="flex gap-4 pt-1">
                                                                      <div className="flex items-center space-x-2"><RadioGroupItem value="single" id={`q${qIndex}-type-single`}/><Label htmlFor={`q${qIndex}-type-single`} className="font-normal">Single Answer</Label></div>
                                                                      <div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id={`q${qIndex}-type-multi`}/><Label htmlFor={`q${qIndex}-type-multi`} className="font-normal">Multiple Answers</Label></div>
                                                                  </RadioGroup>
                                                              </div>

                                                              <div className="space-y-2">
                                                                <Label>Options (select correct answer/s)</Label>
                                                                    {q.options.map((opt, oIndex) => (
                                                                        <div key={oIndex} className="flex items-center space-x-2">
                                                                             {q.questionType === 'multiple' ? (
                                                                                <Checkbox 
                                                                                    id={`q${qIndex}-o${oIndex}`}
                                                                                    checked={q.correctAnswers.includes(oIndex)}
                                                                                    onCheckedChange={(checked) => handleCorrectAnswerChange(qIndex, oIndex, !!checked)}
                                                                                />
                                                                            ) : (
                                                                                <RadioGroup value={String((q.correctAnswers || [])[0])} onValueChange={() => handleCorrectAnswerChange(qIndex, oIndex, true)} className="flex items-center">
                                                                                    <RadioGroupItem value={String(oIndex)} id={`q${qIndex}-o${oIndex}`} />
                                                                                </RadioGroup>
                                                                            )}
                                                                            <Label htmlFor={`q${qIndex}-o${oIndex}`} className="flex-1 cursor-pointer font-normal">
                                                                                <Input value={opt} onChange={e => handleQuizOptionChange(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} disabled={isSubmitting}/>
                                                                            </Label>
                                                                        </div>
                                                                    ))}
                                                              </div>
                                                          </div>
                                                      ))}
                                                      <Button type="button" variant="outline" size="sm" onClick={handleAddQuizQuestion}>Add Another Question</Button>
                                                  </div>
                                                ) : resourceType === 'note' ? (
                                                   <div className="space-y-4 p-4 border bg-background rounded-md">
                                                     <Label className="text-lg">Multi-page Note Editor</Label>
                                                     {notePages.map((pageContent, index) => (
                                                         <div key={index} className="p-3 border rounded-lg space-y-3 bg-muted/50">
                                                            <div className="flex justify-between items-center">
                                                                <Label>Page {index + 1}</Label>
                                                                {notePages.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveNotePage(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                                            </div>
                                                            <div className="mt-1 prose prose-sm max-w-none dark:prose-invert [&_.ck-editor__main>.ck-editor__editable]:min-h-40 [&_.ck-editor__main>.ck-editor__editable]:bg-background [&_.ck-toolbar]:bg-muted [&_.ck-toolbar]:border-border [&_.ck-editor__main]:border-border [&_.ck-content]:text-foreground">
                                                              <Editor
                                                                value={pageContent}
                                                                onChange={(data) => handleNotePageChange(index, data)}
                                                                disabled={isSubmitting}
                                                              />
                                                            </div>
                                                         </div>
                                                     ))}
                                                     <Button type="button" variant="outline" size="sm" onClick={handleAddNotePage}><BookCopy className="mr-2 h-4 w-4"/>Add Page</Button>
                                                  </div>
                                                ) : (resourceType === 'webinar' || resourceType === 'youtube_playlist') ? (
                                                  <div>
                                                      <Label htmlFor={`res-content-${lesson.id}`}>{resourceType === 'webinar' ? 'Webinar URL' : 'YouTube Playlist URL'}</Label>
                                                      <Input id={`res-content-${lesson.id}`} value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder='https://...' type="url" required disabled={isSubmitting} />
                                                  </div>
                                                ) : ['video', 'ebook', 'ppt', 'audio'].includes(resourceType) ? (
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
                                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} {editingResource ? 'Update Resource' : 'Add Resource'}
                                                    </Button>
                                                    <Button type="button" variant="outline" onClick={() => setIsResourceFormOpen(null)} disabled={isSubmitting}>Cancel</Button>
                                                </div>
                                           </form>
                                       </CardContent>
                                   </Card>
                               ) : (
                                  isSuperAdmin && (
                                    <Button size="sm" variant="outline" className="mt-4" onClick={() => handleOpenResourceForm(lesson.id)} disabled={isSubmitting}>
                                        <PlusCircle className="mr-2 h-4 w-4"/> Add Resource to this Lesson
                                    </Button>
                                  )
                               )}

                                {isSuperAdmin && (
                                    <div className="border-t mt-4 pt-4">
                                        <Button size="sm" variant="destructive" onClick={() => handleDeleteLesson(lesson.id)} disabled={isSubmitting}>
                                            <Trash2 className="mr-2 h-4 w-4"/> Delete Entire Lesson
                                        </Button>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>

            {isSuperAdmin && (
                isLessonFormOpen ? (
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
                )
            )}

        </CardContent>
        <CardFooter>
            <Button variant="outline" onClick={() => router.push(isSuperAdmin ? '/superadmin/lms/courses' : '/admin/lms/courses')} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Courses
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
