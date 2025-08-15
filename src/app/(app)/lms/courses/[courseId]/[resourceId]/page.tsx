
"use client";

import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCourseForViewingAction, checkUserEnrollmentForCourseViewAction, markResourceAsCompleteAction, getCompletionStatusAction } from '../actions';
import type { LessonContentResource, QuizQuestion, Course, CourseResource, UserRole } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion, ArrowRight, CheckCircle, Award, Presentation, Lock } from 'lucide-react';
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

// Configure the worker to be served from the public directory
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;


// Function to get the correct embed URL for different services
const getEmbedUrl = (url: string, type: CourseResourceType): string | null => {
    try {
        if (type === 'video') {
            if (url.includes("youtube.com/watch?v=")) {
                const videoId = url.split('v=')[1]?.split('&')[0];
                return `https://www.youtube.com/embed/${videoId}`;
            }
            if (url.includes("youtu.be/")) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }
        
        if (url.includes("drive.google.com/file/d/")) {
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

    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;


    const calculateProgress = (completedResources: Record<string, boolean>) => {
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

    const handleMarkAsComplete = async () => {
        const userId = localStorage.getItem('currentUserId');
        if (!userId) return;

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
    };


    useEffect(() => {
        if (typeof window !== 'undefined') {
          const previewParam = searchParams.get('preview') === 'true';
          const role = localStorage.getItem('currentUserRole') as UserRole | null;
          setCurrentUserRole(role);
          const isAdmin = role === 'admin' || role === 'superadmin';
          setIsPreviewing(isAdmin && previewParam);
        }
    }, [searchParams]);


    useEffect(() => {
        if (courseId && resourceId) {
            setIsLoading(true);
            setNumPages(null);
            setQuizQuestions([]);
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setQuizResult(null);

            getCourseForViewingAction(courseId).then(async result => {
                if (result.ok && result.course) {
                    const loadedCourse = result.course;
                    setCourse(loadedCourse);
                    
                    const userId = localStorage.getItem('currentUserId');
                    if(userId) {
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
                           const totalCompleted = Object.values(completionResult.completedResources).filter(Boolean).length;
                           const lessons = loadedCourse.resources.filter(r => r.type === 'note');
                            const allLessonContents = lessons.flatMap(lesson => {
                                try { return JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[]; } 
                                catch { return []; }
                            });
                            const totalResources = allLessonContents.length;
                            setOverallProgress(totalResources > 0 ? Math.round((totalCompleted / totalResources) * 100) : 0);
                        }
                    }

                    const lessons = loadedCourse.resources.filter(r => r.type === 'note');
                    const allLessonContents = lessons.flatMap(lesson => {
                        try { return JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[]; } 
                        catch { return []; }
                    });
                    
                    const firstLesson = lessons.length > 0 ? lessons[0] : null;
                    const resourcesInFirstLessonIds = firstLesson ? (JSON.parse(firstLesson.url_or_content || '[]') as LessonContentResource[]).map(r => r.id) : [];

                    const currentIndex = allLessonContents.findIndex(r => r.id === resourceId);

                    if (currentIndex !== -1) {
                        const currentResource = allLessonContents[currentIndex];
                        setResource(currentResource);
                        
                        const isAdminPreviewing = (currentUserRole === 'admin' || currentUserRole === 'superadmin') && searchParams.get('preview') === 'true';
                        
                        if (isAdminPreviewing && !resourcesInFirstLessonIds.includes(resourceId)) {
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
            });
        }
    }, [courseId, resourceId, searchParams, currentUserRole]);

    const pdfFile = useMemo(() => (
      (resource?.type === 'ebook' && resource.url_or_content.endsWith('.pdf')) && resource.url_or_content
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

    const handleSubmitQuiz = () => {
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
    };

    const handleRetakeQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setQuizResult(null);
    };

    if (isLoading) {
        return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading resource...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-destructive">{error}</div>;
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
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                        <CardTitle className="flex items-center">
                            {getResourceIcon(resource.type)}
                            {resource.title}
                        </CardTitle>
                        {!isPreviewing && (
                          <div className="flex items-center gap-2">
                              <Button 
                                  onClick={handleMarkAsComplete} 
                                  disabled={isCompleted} 
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
                    {(resource.type === 'video' || resource.type === 'ebook') && embedUrl ? (
                        <iframe
                            src={embedUrl}
                            title={resource.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full rounded-md aspect-video bg-black"
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

                    {resource.type === 'note' && (
                        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: resource.url_or_content }} />
                    )}
                    
                    {pdfFile && (
                        <div className="w-full overflow-auto" style={{ height: '70vh' }}>
                            <Document
                                file={pdfFile}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                                error={<div className="text-destructive text-center p-4">Could not load the PDF file. Please ensure the URL is correct and accessible.</div>}
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
                        isCompleted && overallProgress === 100 ? (
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
