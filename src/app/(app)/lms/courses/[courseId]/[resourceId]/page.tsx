
"use client";

import { useState, useEffect, type FormEvent, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction, markResourceAsCompleteAction, getCompletionStatusAction } from '../actions';
import type { LessonContentResource, QuizQuestion, Course, CourseResourceType, CourseResource, UserRole, DNDActivityData } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion, ArrowRight, CheckCircle, Award, Presentation, Lock, Music, MousePointerSquareDashed, ListVideo, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import PageHeader from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import HTMLFlipBook from 'react-pageflip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { DragAndDropViewer } from '@/components/lms/dnd/DragAndDropViewer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Configure the worker to be served from the public directory
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;


// Function to get the correct embed URL for different services
const getEmbedUrl = (url: string, type: CourseResourceType): string | null => {
    try {
        if (url.includes("youtube.com/watch?v=")) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        if (url.includes("youtu.be/")) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        if (url.includes("youtube.com/playlist?list=")) {
            const listId = url.split('list=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/videoseries?list=${listId}`;
        }
        if (url.includes("open.spotify.com/track/")) {
            const trackId = url.split('track/')[1]?.split('?')[0];
            return `https://open.spotify.com/embed/track/${trackId}`;
        }
        
        if (type === 'ebook' && url.includes("drive.google.com/file/d/")) {
            const fileId = url.split('/d/')[1]?.split('/')[0];
            return `https://drive.google.com/file/d/${fileId}/preview`;
        }

        // For direct video links that can be played by the <video> tag
        if (type === 'video' && url.match(/\.(mp4|webm|ogg)$/i)) {
            return url;
        }

    } catch (e) {
        console.error("Error parsing URL for embed:", e);
        return null;
    }

    return null;
};


export default function CourseResourcePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [course, setCourse] = useState<(Course & { resources: CourseResource[] }) | null>(null);
    const [resource, setResource] = useState<LessonContentResource | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Navigation state
    const [previousResourceId, setPreviousResourceId] = useState<string | null>(null);
    const [nextResourceId, setNextResourceId] = useState<string | null>(null);
    const [previousResourceTitle, setPreviousResourceTitle] = useState<string | null>(null);
    const [nextResourceTitle, setNextResourceTitle] = useState<string | null>(null);
    
    // Completion state
    const [isCompleted, setIsCompleted] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);

    // Certificate state
    const [currentStudentName, setCurrentStudentName] = useState<string>('');
    const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

    // Preview and access control state
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isContentLocked, setIsContentLocked] = useState(false);

    // PDF viewer state
    const [numPages, setNumPages] = useState<number | null>(null);
    
    // Quiz state
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [quizResult, setQuizResult] = useState<{ score: number; total: number; passed: boolean; } | null>(null);

    // Note (multi-page) state
    const [notePages, setNotePages] = useState<string[]>([]);

    // DND Activity State
    const [dndActivityData, setDndActivityData] = useState<DNDActivityData | null>(null);
    
    // Timer state
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);


    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;


    const calculateProgress = useCallback((completedResources: Record<string, boolean>) => {
        if (!course) return 0;
        const lessons = course.resources.filter(r => r.type === 'note');
        if (lessons.length === 0) return 0;
        const allLessonContents = lessons.flatMap(lesson => {
            try { return JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[]; } 
            catch { return []; }
        });
        if (allLessonContents.length === 0) return 0;
        const completedCount = allLessonContents.filter(res => completedResources[res.id]).length;
        return Math.round((completedCount / allLessonContents.length) * 100);
    }, [course]);

    const handleMarkAsComplete = useCallback(async () => {
        const userId = localStorage.getItem('currentUserId');
        const role = localStorage.getItem('currentUserRole');
        
        if (role !== 'student') {
             toast({title: "Info", description: "Progress tracking is only available for students.", variant: "default"});
             return;
        }
        
        if (!userId || !resource) return;

        const result = await markResourceAsCompleteAction(userId, courseId, resourceId);
        if (result.ok) {
            setIsCompleted(true);
            const { completedResources } = await getCompletionStatusAction(userId, courseId);
            if (completedResources) {
                setOverallProgress(calculateProgress(completedResources));
            }
        } else {
            toast({title: "Error", description: result.message, variant: "destructive"});
        }
    }, [resource, courseId, resourceId, toast, calculateProgress]);


    const handleSubmitQuiz = useCallback(() => {
        let score = 0;
        quizQuestions.forEach((q, index) => {
            if (selectedAnswers[index] === q.correctAnswerIndex) {
                score++;
            }
        });
        
        const percentage = quizQuestions.length > 0 ? (score / quizQuestions.length) * 100 : 0;
        const passed = percentage >= 70; // Pass at 70% or more

        setQuizResult({ score, total: quizQuestions.length, passed });
        
        if (passed) {
             handleMarkAsComplete();
        }
    }, [quizQuestions, selectedAnswers, handleMarkAsComplete]);

    // Timer effect
    useEffect(() => {
      if (resource?.duration_minutes && timeLeft === null) {
          setTimeLeft(resource.duration_minutes);
      }
  
      if (timeLeft !== null && timeLeft > 0 && !timerIntervalRef.current) {
          timerIntervalRef.current = setInterval(() => {
              setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
          }, 1000 * 60); // Decrement every minute
      }
  
      if (timeLeft === 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          toast({ title: "Time's Up!", description: "The timer for this activity has ended.", variant: "destructive" });
          if (resource?.type === 'quiz') handleSubmitQuiz();
      }
  
      return () => {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
    }, [resource, timeLeft, handleSubmitQuiz, toast]);


    useEffect(() => {
        if (courseId && resourceId) {
            setIsLoading(true);
            setNumPages(null);
            setQuizQuestions([]);
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setQuizResult(null);
            setNotePages([]);
            setDndActivityData(null);
            setTimeLeft(null);
            if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;

            async function fetchDataAndCheckAccess() {
                try {

                    const userId = localStorage.getItem('currentUserId');
                    const role = localStorage.getItem('currentUserRole') as UserRole | null;
                    const isPreview = searchParams.get('preview') === 'true';
    
                    if (!userId || !role) {
                        setError("User session not found. Please log in.");
                        setIsLoading(false);
                        return;
                    }
    
                    // First, check access rights.
                    const accessResult = await checkUserEnrollmentForCourseViewAction(courseId, userId, role, isPreview);
                    if (!accessResult.ok || !accessResult.isEnrolled) {
                        setError(accessResult.message || "You are not enrolled in this course.");
                        setIsLoading(false);
                        return;
                    }
                    
                    // If access is granted, fetch the course content.
                    const result = await getCourseForViewingAction(courseId);
                    if (result.ok && result.course) {
                        const loadedCourse = result.course;
                        setCourse(loadedCourse);
                        
                        if(role === 'student') {
                            const { data: user } = await supabase.from('users').select('name, school_id').eq('id', userId).single();
                            setCurrentStudentName(user?.name || 'Valued Student');
                            if (user?.school_id) {
                                const { data: school } = await supabase.from('schools').select('name').eq('id', user.school_id).single();
                                setCurrentSchoolName(school?.name || 'CampusHub');
                            } else {
                                setCurrentSchoolName('CampusHub');
                            }
                            
                            const completionResult = await getCompletionStatusAction(userId, courseId);
                            if(completionResult.ok && completionResult.completedResources){
                               setIsCompleted(!!completionResult.completedResources[resourceId]);
                               setOverallProgress(calculateProgress(completionResult.completedResources));
                            }
                        }
    
                        const lessons = loadedCourse.resources.filter(r => r.type === 'note');
                        const allLessonContents = lessons.flatMap(lesson => {
                            try { return JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[]; } 
                            catch { return []; }
                        });
                        
                        const currentIndex = allLessonContents.findIndex(r => r.id === resourceId);
    
                        if (currentIndex !== -1) {
                            const currentResource = allLessonContents[currentIndex];
                            setResource(currentResource);
                            
                            const isAdminPreviewing = (role === 'admin' || role === 'superadmin') && isPreview;
                            
                            const firstLessonContents = lessons.length > 0 ? (JSON.parse(lessons[0].url_or_content || '[]') as LessonContentResource[]) : [];
                            const isResourceInFirstLesson = firstLessonContents.some(r => r.id === resourceId);
    
                            // Lock content if it's a preview and not in the first lesson
                            if (isAdminPreviewing && !isResourceInFirstLesson) {
                                setIsContentLocked(true);
                            } else {
                               setIsContentLocked(false);
                               if (currentResource.type === 'quiz') {
                                  try {
                                    const questions = JSON.parse(currentResource.url_or_content) as QuizQuestion[];
                                    setQuizQuestions(questions);
                                  } catch(e) {
                                    setError("Failed to load quiz questions.");
                                  }
                               } else if (currentResource.type === 'note' && currentResource.url_or_content.startsWith('[')) {
                                  try {
                                      const pages = JSON.parse(currentResource.url_or_content) as string[];
                                      setNotePages(pages);
                                  } catch(e) {
                                      setError("Failed to load note content.");
                                  }
                               } else if (currentResource.type === 'drag_and_drop') {
                                    try {
                                        const data = JSON.parse(currentResource.url_or_content) as DNDActivityData;
                                        setDndActivityData(data);
                                    } catch(e) {
                                        setError("Failed to load interactive activity.");
                                    }
                               }
                            }
    
                            const prevResource = currentIndex > 0 ? allLessonContents[currentIndex - 1] : null;
                            const nextResource = currentIndex < allLessonContents.length - 1 ? allLessonContents[currentIndex + 1] : null;
    
                            setPreviousResourceId(prevResource ? prevResource.id : null);
                            setPreviousResourceTitle(prevResource ? prevResource.title : null);
                            setNextResourceId(nextResource ? nextResource.id : null);
                            setNextResourceTitle(nextResource ? nextResource.title : null);
    
                        } else {
                            setError("The requested resource could not be found in this course.");
                            setResource(null);
                        }
                    } else {
                        setError(result.message || "Failed to load course details.");
                    }
                    setIsLoading(false);
                } catch (e) {
                    console.error("Failed to fetch course resource:", e);
                    setError("An unexpected error occurred while loading the resource.");
                } finally {
                    setIsLoading(false); // This will now run every time
                }
            }
            fetchDataAndCheckAccess();
        }
    }, [courseId, resourceId, searchParams, calculateProgress]);

    const pdfFile = useMemo(() => (
      (resource?.type === 'ebook' && resource.url_or_content.endsWith('.pdf'))
        ? { url: resource.url_or_content }
        : null
    ), [resource]);

    
    const embedUrl = useMemo(() => {
        if (resource?.type && resource.url_or_content) {
            return getEmbedUrl(resource.url_or_content, resource.type);
        }
        return null;
    }, [resource]);


    const getResourceIcon = (type: string) => {
        const props = { className: "mr-2 h-5 w-5 text-primary" };
        switch(type) {
            case 'ebook': return <BookOpen {...props} />;
            case 'video': return <Video {...props} />;
            case 'note': return <FileText {...props} />;
            case 'webinar': return <Users {...props} />;
            case 'quiz': return <FileQuestion {...props} />;
            case 'ppt': return <Presentation {...props} />;
            case 'audio': return <Music {...props} />;
            case 'drag_and_drop': return <MousePointerSquareDashed {...props} />;
            case 'youtube_playlist': return <ListVideo {...props} />;
            default: return null;
        }
    };
    
    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
    }
    
    // --- Quiz Handlers ---
    const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
        setSelectedAnswers(prev => ({ ...prev, [questionIndex]: answerIndex }));
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleRetakeQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setQuizResult(null);
        if (resource?.duration_minutes) {
          setTimeLeft(resource.duration_minutes * 60); // Reset timer in seconds
        }
    };

    if (isLoading) {
        return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading resource...</div>;
    }

    if (error) {
        return <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Access Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="mt-4">
                 <Link href="/lms/available-courses">Back to Courses</Link>
            </Button>
        </div>;
    }
    
    if (!resource || !course) {
        return <div className="text-center py-10 text-destructive">Resource not found.</div>;
    }

    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';
    const isNextDisabled = !isAdmin && (isPreviewing || !isCompleted);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={resource.title}
                description={`Part of course: ${course.title}`}
                actions={
                    <Button variant="outline" onClick={() => router.push(`/lms/courses/${courseId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Course
                    </Button>
                }
            />
            {timeLeft !== null && (
                <Card className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm">
                    <CardContent className="p-3">
                        <div className="flex justify-center items-center gap-2 font-mono text-lg font-semibold">
                            <Clock className="h-5 w-5"/>
                            <span>Time Left:</span>
                            <span className={timeLeft < 60 ? 'text-destructive' : ''}>
                                {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
                                {(timeLeft % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                        <CardTitle className="flex items-center">
                            {getResourceIcon(resource.type)}
                            {resource.title}
                        </CardTitle>
                        {currentUserRole === 'student' && !isPreviewing && (
                          <div className="flex items-center gap-2">
                              <Button 
                                  onClick={handleMarkAsComplete} 
                                  disabled={isCompleted || resource.type === 'quiz' || resource.type === 'drag_and_drop'} 
                                  size="sm"
                                  variant={isCompleted ? "secondary" : "default"}
                                  className="shrink-0"
                              >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {isCompleted ? "Completed" : "Mark as Completed"}
                              </Button>
                              {isCompleted && (
                                  <Button asChild size="sm">
                                      <Link href={`/lms/courses/${courseId}/certificate?studentName=${encodeURIComponent(currentStudentName)}&courseName=${encodeURIComponent(resource.title)}&schoolName=${encodeURIComponent(currentSchoolName)}&completionDate=${new Date().toISOString()}&certificateId=${uuidv4()}`}>
                                          <Award className="mr-2 h-4 w-4" /> Get Certificate
                                      </Link>
                                  </Button>
                              )}
                          </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="min-h-[60vh]">
                     {isContentLocked ? (
                        <div className="flex flex-col items-center justify-center h-full text-center bg-muted/50 rounded-lg p-8">
                            <Lock className="h-16 w-16 text-muted-foreground mb-4"/>
                            <h2 className="text-2xl font-bold">Content Locked</h2>
                            <p className="text-muted-foreground mt-2">This is part of the course preview.</p>
                            <p className="text-muted-foreground">Enroll in or subscribe to this course to unlock all lessons.</p>
                             <Button asChild className="mt-6" onClick={() => router.push('/admin/lms/courses')}>
                                Back to Course Management
                            </Button>
                        </div>
                    ) : (
                    <>
                    {(resource.type === 'youtube_playlist' || (resource.type === 'video' || resource.type === 'ebook') && embedUrl?.includes('drive.google.com')) || (resource.type === 'video' && embedUrl?.includes('youtube.com')) ? (
                        <iframe
                            src={embedUrl}
                            title={resource.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full rounded-md aspect-video bg-black"
                        ></iframe>
                    ) : (resource.type === 'audio' && embedUrl?.includes('spotify.com')) ? (
                         <iframe
                            src={embedUrl}
                            width="100%"
                            height="352"
                            frameBorder="0"
                            allowFullScreen
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-md"
                        ></iframe>
                    ) : resource.type === 'video' && resource.url_or_content && !embedUrl ? (
                         <video
                            controls
                            autoPlay
                            src={resource.url_or_content}
                            className="w-full rounded-md aspect-video bg-black"
                            controlsList="nodownload nofullscreen noremoteplayback"
                        >
                        Your browser does not support the video tag.
                        </video>
                    ) : null}

                    {resource.type === 'audio' && resource.url_or_content && !embedUrl && (
                         <audio
                            controls
                            autoPlay
                            src={resource.url_or_content}
                            className="w-full rounded-md"
                            controlsList="nodownload"
                        >
                        Your browser does not support the audio element.
                        </audio>
                    )}

                    {resource.type === 'note' && notePages.length > 0 && (
                       <HTMLFlipBook 
                           width={500} 
                           height={700}
                           size="stretch"
                           minWidth={315}
                           maxWidth={1000}
                           minHeight={400}
                           maxHeight={1533}
                           maxShadowOpacity={0.5}
                           showCover={true}
                           mobileScrollSupport={true}
                           className="mx-auto"
                       >
                           {notePages.map((pageHtml, index) => (
                               <div key={index} className="bg-background p-6 border shadow-lg">
                                   <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
                                   <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                                       Page {index + 1} of {notePages.length}
                                   </div>
                               </div>
                           ))}
                       </HTMLFlipBook>
                    )}
                    
                    {pdfFile && (
                        <div className="w-full overflow-auto" style={{ height: '70vh' }}>
                            <Document
                                file={pdfFile}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                                error={<div className="text-destructive text-center p-4">Could not load the PDF file. Please ensure the URL is a direct link to a PDF.</div>}
                            >
                                {numPages && (
                                    <HTMLFlipBook 
                                        width={400} 
                                        height={565} 
                                        showCover={true} 
                                        className="mx-auto"
                                    >
                                        {Array.from(new Array(numPages), (el, index) => (
                                            <div key={`page_${index + 1}`} className="bg-white shadow-lg flex justify-center items-center">
                                                <Page pageNumber={index + 1} renderAnnotationLayer={false} renderTextLayer={false} />
                                            </div>
                                        ))}
                                    </HTMLFlipBook>
                                )}
                            </Document>
                        </div>
                    )}
                    
                    {resource.type === 'ppt' && resource.url_or_content && (
                        <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resource.url_or_content)}`}
                            width='100%'
                            height='600px'
                            frameBorder='0'
                            className="rounded-md"
                        >
                            This is an embedded <a target='_blank' rel="noreferrer" href='http://office.com'>Microsoft Office</a> presentation, powered by <a target='_blank' rel="noreferrer" href='http://office.com/webapps'>Office Online</a>.
                        </iframe>
                    )}

                    {resource.type === 'webinar' && resource.url_or_content && (
                         <Button asChild variant="link" className="text-lg p-0 h-auto">
                            <a href={resource.url_or_content} target="_blank" rel="noopener noreferrer">
                                <Users className="mr-2 h-5 w-5"/> Click here to join the Webinar
                            </a>
                        </Button>
                    )}
                    
                    {resource.type === 'drag_and_drop' && dndActivityData && (
                        <DragAndDropViewer activityData={dndActivityData} onComplete={handleMarkAsComplete} />
                    )}

                    {resource.type === 'quiz' && quizQuestions.length > 0 && (
                        <div className="p-2 sm:p-4">
                            {!quizResult ? (
                                <div>
                                    <Card className="mb-4">
                                        <CardHeader>
                                            <CardTitle>Question {currentQuestionIndex + 1} of {quizQuestions.length}</CardTitle>
                                            <CardDescription className="text-lg pt-2">{quizQuestions[currentQuestionIndex].question}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <RadioGroup
                                                value={selectedAnswers[currentQuestionIndex]?.toString()}
                                                onValueChange={(value) => handleAnswerChange(currentQuestionIndex, parseInt(value))}
                                                className="space-y-2"
                                            >
                                                {quizQuestions[currentQuestionIndex].options.map((option, index) => (
                                                    <div key={index} className="flex items-center space-x-3 p-3 rounded-md border hover:bg-muted/50 has-[[data-state=checked]]:bg-muted">
                                                        <RadioGroupItem value={index.toString()} id={`q${currentQuestionIndex}-o${index}`} />
                                                        <Label htmlFor={`q${currentQuestionIndex}-o${index}`} className="w-full cursor-pointer">{option}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </CardContent>
                                    </Card>
                                    <div className="flex justify-between mt-4">
                                        <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>Previous</Button>
                                        {currentQuestionIndex < quizQuestions.length - 1 ? (
                                            <Button onClick={handleNextQuestion}>Next Question</Button>
                                        ) : (
                                            <Button onClick={handleSubmitQuiz}>Submit Quiz</Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center">
                                    <Card className="text-center w-full max-w-md">
                                        <CardHeader>
                                            <CardTitle className="text-2xl">Quiz Results</CardTitle>
                                            <CardDescription>
                                                {quizResult.passed ? "Congratulations, you passed!" : "You did not pass. Please review the material and try again."}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg">You scored</p>
                                            <p className={`text-6xl font-bold my-4 ${quizResult.passed ? 'text-primary' : 'text-destructive'}`}>
                                                {quizResult.score} / {quizResult.total}
                                            </p>
                                            {!quizResult.passed && <Button onClick={handleRetakeQuiz}>Retake Quiz</Button>}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                    </>
                    )}
                </CardContent>
                 <CardFooter className="flex justify-between items-center flex-wrap gap-2">
                    <Button variant="outline" asChild disabled={!previousResourceId}>
                        <Link href={previousResourceId ? `/lms/courses/${courseId}/${previousResourceId}${isPreviewing ? '?preview=true' : ''}` : '#'} className="max-w-xs">
                            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                            <div className="flex flex-col items-start">
                                <span className="text-xs text-muted-foreground">Previous</span>
                                <span className="truncate">{previousResourceTitle || '...'}</span>
                            </div>
                        </Link>
                    </Button>
                    
                    {nextResourceId ? (
                         <Button
                            asChild
                            variant="outline"
                            disabled={isNextDisabled || isContentLocked}
                            title={isNextDisabled ? (isPreviewing ? "Enroll to access next lesson" : "Complete this lesson to proceed") : isContentLocked ? "Enroll to access next lesson" : ""}
                        >
                            <Link href={isNextDisabled || isContentLocked ? "#" : `/lms/courses/${courseId}/${nextResourceId}${isPreviewing ? '?preview=true' : ''}`} className={`max-w-xs ${(isNextDisabled || isContentLocked) ? 'cursor-not-allowed' : ''}`}>
                                {(isNextDisabled || isContentLocked) && <Lock className="mr-2 h-4 w-4 shrink-0" />}
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Next</span>
                                    <span className="truncate">{nextResourceTitle || '...'}</span>
                                </div>
                                {!(isNextDisabled || isContentLocked) && <ArrowRight className="ml-2 h-4 w-4 shrink-0" />}
                            </Link>
                        </Button>
                    ) : (
                        currentUserRole === 'student' && isCompleted && overallProgress === 100 ? (
                           <Button asChild>
                                <Link href={`/lms/courses/${courseId}/certificate?studentName=${encodeURIComponent(currentStudentName)}&courseName=${encodeURIComponent(course.title)}&schoolName=${encodeURIComponent(currentSchoolName)}&completionDate=${new Date().toISOString()}&certificateId=${uuidv4()}`}>
                                    <Award className="mr-2 h-4 w-4" /> Course Complete! Get Certificate
                                </Link>
                            </Button>
                        ) : (
                            <Button variant="outline" disabled={true} className="max-w-xs">
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">End of course</span>
                                </div>
                                <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                            </Button>
                        )
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
