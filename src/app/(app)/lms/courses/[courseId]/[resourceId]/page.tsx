
"use client";

import { useState, useEffect, type FormEvent, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction, markResourceAsCompleteAction, getCompletionStatusAction } from '../actions';
import type { LessonContentResource, QuizQuestion, Course, CourseResource, UserRole, DNDActivityData, CourseResourceType, WebPageContent } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion, ArrowRight, CheckCircle, Award, Presentation, Lock, Music, MousePointerSquareDashed, ListVideo, Clock, AlertTriangle, Code } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { WebPageRenderer } from '@/components/lms/WebPageRenderer';

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
        
        if (type === 'ppt' && url.includes("docs.google.com/presentation/d/")) {
            const presentationId = url.split('/d/')[1]?.split('/')[0];
            return `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;
        }

        if ((type === 'ebook' || type === 'ppt') && url.includes("drive.google.com/file/d/")) {
            const fileId = url.split('/d/')[1]?.split('/')[0];
            // Add parameters to hide the toolbar and fit the page horizontally to prevent the "pop out" button
            return `https://drive.google.com/file/d/${fileId}/preview#view=FitH&toolbar=0`;
        }

        if (type === 'video' && url.match(/\.(mp4|webm|ogg)$/i)) {
            return url;
        }

    } catch (e) {
        console.error("Error parsing URL for embed:", e);
        return null;
    }

    return null;
};

// Moved outside the component to prevent re-creation on every render.
const calculateProgress = (course: (Course & { resources: CourseResource[] }) | null, completedResources: Record<string, boolean>): number => {
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
};


export default function CourseResourcePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // All state definitions are correct
    const [course, setCourse] = useState<(Course & { resources: CourseResource[] }) | null>(null);
    const [resource, setResource] = useState<LessonContentResource | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previousResourceId, setPreviousResourceId] = useState<string | null>(null);
    const [nextResourceId, setNextResourceId] = useState<string | null>(null);
    const [previousResourceTitle, setPreviousResourceTitle] = useState<string | null>(null);
    const [nextResourceTitle, setNextResourceTitle] = useState<string | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);
    const [currentStudentName, setCurrentStudentName] = useState<string>('');
    const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isContentLocked, setIsContentLocked] = useState(false);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number[]>>({});
    const [quizResult, setQuizResult] = useState<{ score: number; total: number; passed: boolean; } | null>(null);
    const [notePages, setNotePages] = useState<string[]>([]);
    const [dndActivityData, setDndActivityData] = useState<DNDActivityData | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [webPageContent, setWebPageContent] = useState<WebPageContent | null>(null);

    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;
    
    const handleMarkAsComplete = useCallback(async () => {
        const userId = localStorage.getItem('currentUserId');
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        
        if (role !== 'student' && role !== 'teacher') {
            setIsCompleted(true);
            toast({title: "Completed", description: "You marked this resource as complete.", variant: "default"});
            return;
        }

        if (role === 'teacher') {
             setIsCompleted(true);
             return;
        }
        
        if (!userId || !resource || !courseId) return;

        const result = await markResourceAsCompleteAction(userId, courseId, resourceId);
        if (result.ok) {
            setIsCompleted(true);
            const { completedResources } = await getCompletionStatusAction(userId, courseId);
            if (completedResources && course) {
                setOverallProgress(calculateProgress(course, completedResources));
            }
        } else {
            toast({title: "Error", description: result.message, variant: "destructive"});
        }
    }, [resource, courseId, resourceId, toast, course]);
    
    const handleSubmitQuiz = useCallback(() => {
        if (quizResult) return; // Prevent re-submission
        let score = 0;
        quizQuestions.forEach((q, index) => {
            const userAnswers = new Set(selectedAnswers[index] || []);
            const correctAnswers = new Set(q.correctAnswers);
            
            if(q.questionType === 'multiple') {
                if(userAnswers.size === correctAnswers.size && [...userAnswers].every(answer => correctAnswers.has(answer))) {
                    score++;
                }
            } else { // single
                if(userAnswers.size === 1 && correctAnswers.has([...userAnswers][0])) {
                    score++;
                }
            }
        });
        
        const percentage = quizQuestions.length > 0 ? (score / quizQuestions.length) * 100 : 0;
        const passed = percentage >= 70; // Pass at 70% or more

        setQuizResult({ score, total: quizQuestions.length, passed });
        
        if (passed) {
             handleMarkAsComplete();
        }
    }, [quizQuestions, selectedAnswers, handleMarkAsComplete, quizResult]);

    // Role and preview status check
    useEffect(() => {
        if (typeof window !== 'undefined') {
          const previewParam = searchParams.get('preview') === 'true';
          const role = localStorage.getItem('currentUserRole') as UserRole | null;
          setCurrentUserRole(role);
          const isAdmin = role === 'admin' || role === 'superadmin';
          setIsPreviewing(isAdmin && previewParam);
        }
    }, [searchParams]);

    // Timer effect
    useEffect(() => {
        if (resource?.duration_minutes && timeLeft === null) {
            setTimeLeft(resource.duration_minutes);
        }

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (timeLeft !== null && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (resource?.type === 'quiz' && !quizResult) {
                toast({ title: "Time's Up!", description: "The timer for this activity has ended.", variant: "destructive" });
                handleSubmitQuiz();
            }
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [resource, timeLeft, handleSubmitQuiz, quizResult, toast]);


    // MAIN DATA FETCHING EFFECT
    const fetchDataAndCheckAccess = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        // Reset resource-specific states
        setNumPages(null); setQuizQuestions([]); setCurrentQuestionIndex(0);
        setSelectedAnswers({}); setQuizResult(null); setNotePages([]);
        setDndActivityData(null);
        setWebPageContent(null);
        setTimeLeft(null);
        if(timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;

        try {
            const userId = localStorage.getItem('currentUserId');
            if (!userId || !currentUserRole) {
                throw new Error("User session not found. Please log in.");
            }

            // First, check if user has access rights
            const accessResult = await checkUserEnrollmentForCourseViewAction(courseId, userId, currentUserRole, isPreviewing);
            if (!accessResult.ok || !accessResult.isEnrolled) {
                throw new Error(accessResult.message || "You do not have access to this course.");
            }
            
            // If access is granted, fetch the course content
            const courseResult = await getCourseForViewingAction(courseId);
            if (!courseResult.ok || !courseResult.course) {
                throw new Error(courseResult.message || "Failed to load course details.");
            }
            const loadedCourse = courseResult.course;
            setCourse(loadedCourse);

            // Fetch student-specific details if the user is a student
            if (currentUserRole === 'student') {
                const { data: user } = await supabase.from('users').select('name, school_id').eq('id', userId).single();
                setCurrentStudentName(user?.name || 'Valued Student');
                if (user?.school_id) {
                    const { data: school } = await supabase.from('schools').select('name').eq('id', user.school_id).single();
                    setCurrentSchoolName(school?.name || 'CampusHub');
                } else {
                    setCurrentSchoolName('CampusHub');
                }
                const completionResult = await getCompletionStatusAction(userId, courseId);
                if (completionResult.ok && completionResult.completedResources) {
                    setIsCompleted(!!completionResult.completedResources[resourceId]);
                    setOverallProgress(calculateProgress(loadedCourse, completionResult.completedResources));
                }
            }

            // Process the fetched resources to find the current one and its neighbors
            const lessons = loadedCourse.resources.filter(r => r.type === 'note');
            const allLessonContents = lessons.flatMap(lesson => {
                try { return JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[]; } catch { return []; }
            });
            
            const currentIndex = allLessonContents.findIndex(r => r.id === resourceId);

            if (currentIndex === -1) {
                throw new Error("The requested resource could not be found in this course.");
            }
            
            const currentResource = allLessonContents[currentIndex];
            setResource(currentResource);

            setIsContentLocked(false);
            
            // Parse content for specific resource types
            try {
                if (currentResource.type === 'quiz') {
                     const loadedQuestions: QuizQuestion[] = JSON.parse(currentResource.url_or_content || '[]') || [];
                     const migratedQuestions = loadedQuestions.map(q => {
                        if (q.correctAnswerIndex !== undefined && q.correctAnswers === undefined) {
                            return { ...q, questionType: 'single', correctAnswers: [q.correctAnswerIndex] };
                        }
                        return { ...q, questionType: q.questionType || 'single', correctAnswers: q.correctAnswers || [] };
                    });
                    setQuizQuestions(migratedQuestions);
                }
                else if (currentResource.type === 'note' && currentResource.url_or_content.startsWith('[')) {
                    setNotePages(JSON.parse(currentResource.url_or_content));
                }
                else if (currentResource.type === 'drag_and_drop') {
                    setDndActivityData(JSON.parse(currentResource.url_or_content));
                } else if (currentResource.type === 'web_page') {
                    setWebPageContent(JSON.parse(currentResource.url_or_content || '{}'));
                }
            } catch(e) { throw new Error(`Failed to load content for this resource. It might be corrupted.`); }

            // Set up navigation
            const prevResource = currentIndex > 0 ? allLessonContents[currentIndex - 1] : null;
            const nextResource = currentIndex < allLessonContents.length - 1 ? allLessonContents[currentIndex + 1] : null;
            
            setPreviousResourceId(prevResource?.id || null);
            setPreviousResourceTitle(prevResource?.title || null);
            setNextResourceId(nextResource?.id || null);
            setNextResourceTitle(nextResource?.title || null);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [courseId, resourceId, currentUserRole, isPreviewing, calculateProgress]);

    useEffect(() => {
        if(currentUserRole !== null) {
            fetchDataAndCheckAccess();
        }
    }, [fetchDataAndCheckAccess, currentUserRole]); // Re-run when role is determined


    const pdfFile = useMemo(() => ((resource?.type === 'ebook' && resource.url_or_content.endsWith('.pdf')) ? { url: resource.url_or_content } : null), [resource]);
    const embedUrl = useMemo(() => (resource?.type && resource.url_or_content) ? getEmbedUrl(resource.url_or_content, resource.type) : null, [resource]);

    const getResourceIcon = (type: string) => {
        const props = { className: "mr-3 h-5 w-5" };
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
            case 'web_page': return <Code {...props} />;
            default: return null;
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void { setNumPages(numPages); }

    const handleAnswerChange = (questionIndex: number, answerIndex: number, isChecked: boolean) => {
      setSelectedAnswers(prev => {
        const newAnswers = { ...prev };
        const question = quizQuestions[questionIndex];
        const currentAnswers = new Set(newAnswers[questionIndex] || []);

        if (question.questionType === 'single') {
            newAnswers[questionIndex] = [answerIndex];
        } else { // multiple
            if (isChecked) {
                currentAnswers.add(answerIndex);
            } else {
                currentAnswers.delete(answerIndex);
            }
            newAnswers[questionIndex] = Array.from(currentAnswers);
        }
        return newAnswers;
      });
    };

    const handleNextQuestion = () => { if (currentQuestionIndex < quizQuestions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); } };
    const handlePreviousQuestion = () => { if (currentQuestionIndex > 0) { setCurrentQuestionIndex(prev => prev - 1); } };
    const handleRetakeQuiz = () => {
        setQuizResult(null);
        setSelectedAnswers({});
        setCurrentQuestionIndex(0);
        if(resource?.duration_minutes) {
             setTimeLeft(resource.duration_minutes);
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
    const canMarkComplete = currentUserRole === 'student' || currentUserRole === 'teacher';
    const isNextDisabled = !nextResourceId || (isPreviewing ? false : (!isAdmin && !isCompleted));
    
    const backToCoursesPath = isAdmin
        ? `/admin/lms/courses/${courseId}/content` 
        : '/lms/available-courses';


    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={resource.title}
                description={`Part of course: ${course.title}`}
                actions={
                    <Button variant="outline" asChild>
                        <Link href={isPreviewing ? `/admin/lms/courses/${courseId}/content` : `/lms/courses/${courseId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Course
                        </Link>
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
                        {canMarkComplete && (
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
                              {isCompleted && currentUserRole === 'student' && (
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
                             <Button asChild className="mt-6">
                                <Link href={backToCoursesPath}>Back to Course Management</Link>
                            </Button>
                        </div>
                    ) : (
                    <>
                     {resource.type === 'video' && (
                        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                           {embedUrl ? (
                             <iframe src={embedUrl} title={resource.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                           ) : (
                             <video controls className="w-full h-full" src={resource.url_or_content}><p>Your browser does not support the video tag.</p></video>
                           )}
                        </div>
                     )}
                      {resource.type === 'youtube_playlist' && embedUrl && (
                         <div className="space-y-4">
                            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                                <iframe src={embedUrl} title={resource.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                            </div>
                            <div className="w-full bg-black rounded-lg overflow-hidden">
                                <iframe src={embedUrl.replace('/embed/videoseries', '/embed/embed/videoseries')} title={`${resource.title} Playlist`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" className="w-full h-[50vh]"></iframe>
                            </div>
                         </div>
                      )}
                     {resource.type === 'audio' && (
                        <div className="w-full">
                           {embedUrl ? (
                             <iframe src={embedUrl} title={resource.title} frameBorder="0" allow="encrypted-media" className="w-full h-20"></iframe>
                           ) : (
                             <audio controls className="w-full" src={resource.url_or_content}><p>Your browser does not support the audio element.</p></audio>
                           )}
                        </div>
                     )}
                     {resource.type === 'note' && (
                        <HTMLFlipBook width={550} height={733} showCover={true} className="mx-auto">
                            {notePages.map((page, index) => (
                                <div key={index} className="p-4 bg-background border-r">
                                    <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: page }}/>
                                    <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">{index + 1}</span>
                                </div>
                            ))}
                        </HTMLFlipBook>
                     )}
                     {resource.type === 'web_page' && webPageContent && <WebPageRenderer content={webPageContent} />}
                     {(resource.type === 'ebook' || resource.type === 'ppt') && (
                        embedUrl ? (
                             <iframe src={embedUrl} title={resource.title} className="w-full h-[80vh]"></iframe>
                        ) : pdfFile ? (
                           <div className="w-full flex justify-center">
                                <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
                                    {Array.from(new Array(numPages), (el, index) => (
                                        <Page key={`page_${index + 1}`} pageNumber={index + 1} renderAnnotationLayer={false} renderTextLayer={false}/>
                                    ))}
                                </Document>
                           </div>
                        ) : <p>Could not display content. The URL might be misconfigured or the file type unsupported.</p>
                     )}
                     {resource.type === 'webinar' && (
                        <div className="text-center p-8">
                            <h2 className="text-2xl font-bold mb-4">Webinar Link</h2>
                            <p className="mb-4">This resource is an external link to a webinar or live session.</p>
                            <Button asChild><a href={resource.url_or_content}>Join Webinar</a></Button>
                        </div>
                     )}
                     {resource.type === 'drag_and_drop' && dndActivityData && (
                        <DragAndDropViewer activityData={dndActivityData} onComplete={handleMarkAsComplete} />
                     )}
                     {resource.type === 'quiz' && (
                        quizResult ? (
                            <div className="text-center p-8">
                                <h2 className="text-2xl font-bold mb-4">Quiz Complete!</h2>
                                <p className="text-lg mb-2">You scored:</p>
                                <p className="text-4xl font-bold mb-4">{quizResult.score} / {quizResult.total}</p>
                                {quizResult.passed ? (
                                    <p className="text-green-600 font-semibold flex items-center justify-center"><CheckCircle className="mr-2 h-5 w-5"/> You Passed!</p>
                                ) : (
                                    <p className="text-destructive font-semibold">You did not pass this time. Try again!</p>
                                )}
                                <Button onClick={handleRetakeQuiz} className="mt-6">Retake Quiz</Button>
                            </div>
                        ) : (
                          <div className="max-w-2xl mx-auto space-y-6">
                            <p className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {quizQuestions.length}</p>
                            <h3 className="text-lg font-semibold">{quizQuestions[currentQuestionIndex].question}</h3>
                            <div className="space-y-2">
                                {quizQuestions[currentQuestionIndex].options.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50">
                                        {quizQuestions[currentQuestionIndex].questionType === 'multiple' ? (
                                            <Checkbox
                                                id={`q${currentQuestionIndex}-o${index}`}
                                                checked={(selectedAnswers[currentQuestionIndex] || []).includes(index)}
                                                onCheckedChange={(checked) => handleAnswerChange(currentQuestionIndex, index, !!checked)}
                                                disabled={timeLeft === 0}
                                            />
                                        ) : (
                                            <RadioGroup
                                                value={String((selectedAnswers[currentQuestionIndex] || [])[0])}
                                                onValueChange={() => handleAnswerChange(currentQuestionIndex, index, true)}
                                                className="flex items-center"
                                                disabled={timeLeft === 0}
                                            >
                                                <RadioGroupItem value={String(index)} id={`q${currentQuestionIndex}-o${index}`} />
                                            </RadioGroup>
                                        )}
                                        <Label htmlFor={`q${currentQuestionIndex}-o${index}`} className="flex-1 cursor-pointer">{option}</Label>
                                    </div>
                                ))}
                            </div>
                             <div className="flex justify-between mt-4">
                                <Button onClick={handlePreviousQuestion} variant="outline" disabled={currentQuestionIndex === 0 || timeLeft === 0}>Previous</Button>
                                {currentQuestionIndex < quizQuestions.length - 1 ? (
                                    <Button onClick={handleNextQuestion} disabled={timeLeft === 0}>Next</Button>
                                ) : (
                                    <Button onClick={handleSubmitQuiz} disabled={!selectedAnswers[currentQuestionIndex] || timeLeft === 0}>Submit Quiz</Button>
                                )}
                            </div>
                          </div>
                        )
                     )}
                    </>
                    )}
                </CardContent>
                 <CardFooter className="flex justify-between items-center flex-wrap gap-2">
                     <div className="flex-1 min-w-[150px]">
                        {previousResourceId && (
                            <Button variant="outline" asChild className="w-full justify-start text-left">
                                <Link href={`/lms/courses/${courseId}/${previousResourceId}${isPreviewing ? '?preview=true': ''}`} className="flex items-center">
                                    <ArrowLeft className="mr-2 h-4 w-4 shrink-0"/>
                                    <span className="truncate">Previous: {previousResourceTitle}</span>
                                </Link>
                            </Button>
                        )}
                    </div>
                    
                     <div className="flex-1 min-w-[150px] flex justify-end">
                        {nextResourceId && (
                            <Button variant="outline" disabled={isNextDisabled} asChild className="w-full justify-end text-left">
                                <Link href={!isNextDisabled ? `/lms/courses/${courseId}/${nextResourceId}${isPreviewing ? '?preview=true': ''}` : '#'} className="flex items-center">
                                    <span className="truncate">Next: {nextResourceTitle}</span>
                                    <ArrowRight className="ml-2 h-4 w-4 shrink-0"/>
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
