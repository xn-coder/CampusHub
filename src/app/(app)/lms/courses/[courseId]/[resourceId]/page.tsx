
"use client";

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCourseForViewingAction } from '../actions';
import type { LessonContentResource, QuizQuestion } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import PageHeader from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import HTMLFlipBook from 'react-pageflip';

// Configure the worker to be served locally from the installed package
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


export default function CourseResourcePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;

    const [resource, setResource] = useState<LessonContentResource | null>(null);
    const [courseTitle, setCourseTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Navigation state
    const [previousResourceId, setPreviousResourceId] = useState<string | null>(null);
    const [nextResourceId, setNextResourceId] = useState<string | null>(null);
    const [previousResourceTitle, setPreviousResourceTitle] = useState<string | null>(null);
    const [nextResourceTitle, setNextResourceTitle] = useState<string | null>(null);
    
    // Completion state
    const [isCompleted, setIsCompleted] = useState(false);

    // PDF viewer state
    const [numPages, setNumPages] = useState<number | null>(null);
    
    // Quiz state
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [quizResult, setQuizResult] = useState<{ score: number; total: number; passed: boolean; } | null>(null);


    useEffect(() => {
        if (typeof window !== 'undefined') {
          const storedProgressString = localStorage.getItem(`progress_${courseId}`);
          const storedProgress = storedProgressString ? JSON.parse(storedProgressString) : {};
          setIsCompleted(!!storedProgress[resourceId]);
        }
    }, [courseId, resourceId]);


    useEffect(() => {
        if (courseId && resourceId) {
            setIsLoading(true);
            setNumPages(null);
            setQuizQuestions([]);
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setQuizResult(null);

            getCourseForViewingAction(courseId).then(result => {
                if (result.ok && result.course) {
                    setCourseTitle(result.course.title);

                    const allFlattenedResources: LessonContentResource[] = [];
                    for (const lesson of result.course.resources) {
                        if (lesson.type === 'note') {
                            try {
                                const contents = JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[];
                                allFlattenedResources.push(...contents);
                            } catch (e) {
                                console.error("Failed to parse lesson content", e);
                            }
                        }
                    }

                    const currentIndex = allFlattenedResources.findIndex(r => r.id === resourceId);

                    if (currentIndex !== -1) {
                        const currentResource = allFlattenedResources[currentIndex];
                        setResource(currentResource);
                        
                        if (currentResource.type === 'quiz') {
                          try {
                            const questions = JSON.parse(currentResource.url_or_content) as QuizQuestion[];
                            setQuizQuestions(questions);
                          } catch(e) {
                            setError("Failed to load quiz questions.");
                          }
                        }

                        const prevResource = currentIndex > 0 ? allFlattenedResources[currentIndex - 1] : null;
                        const nextResource = currentIndex < allFlattenedResources.length - 1 ? allFlattenedResources[currentIndex + 1] : null;

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
    }, [courseId, resourceId]);

    const getResourceIcon = (type: string) => {
        const props = { className: "mr-2 h-5 w-5 text-primary" };
        switch(type) {
            case 'ebook': return <BookOpen {...props} />;
            case 'video': return <Video {...props} />;
            case 'note': return <FileText {...props} />;
            case 'webinar': return <Users {...props} />;
            case 'quiz': return <FileQuestion {...props} />;
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

    const handleMarkAsComplete = () => {
        if (typeof window !== 'undefined') {
            const storedProgressString = localStorage.getItem(`progress_${courseId}`);
            const storedProgress = storedProgressString ? JSON.parse(storedProgressString) : {};
            const newProgress = { ...storedProgress, [resourceId]: true };
            localStorage.setItem(`progress_${courseId}`, JSON.stringify(newProgress));
            setIsCompleted(true);
        }
    };


    if (isLoading) {
        return <div className="text-center py-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading resource...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-destructive">{error}</div>;
    }
    
    if (!resource) {
        return <div className="text-center py-10 text-destructive">Resource not found.</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={resource.title}
                description={`Part of course: ${courseTitle}`}
                actions={
                    <Button variant="outline" onClick={() => router.push(`/lms/courses/${courseId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Course
                    </Button>
                }
            />
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center">
                            {getResourceIcon(resource.type)}
                            {resource.title}
                        </CardTitle>
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
                    </div>
                </CardHeader>
                <CardContent className="min-h-[60vh]">
                    {resource.type === 'video' && resource.url_or_content && (
                        <video 
                            controls 
                            autoPlay 
                            src={resource.url_or_content} 
                            className="w-full rounded-md aspect-video bg-black"
                            controlsList="nodownload nofullscreen noremoteplayback"
                        >
                          Your browser does not support the video tag.
                        </video>
                    )}
                    {resource.type === 'note' && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.url_or_content}</p>
                    )}
                    
                    {(resource.type === 'ebook' || (resource.url_or_content && resource.url_or_content.endsWith('.pdf'))) && resource.url_or_content && (
                        <div className="w-full overflow-auto" style={{ height: '70vh' }}>
                            <Document
                                file={resource.url_or_content}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                                error={<div className="text-destructive text-center p-4">Failed to load PDF file.</div>}
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
                </CardContent>
                 <CardFooter className="flex justify-between items-center">
                    <Button variant="outline" asChild disabled={!previousResourceId}>
                        <Link href={previousResourceId ? `/lms/courses/${courseId}/${previousResourceId}` : '#'} className="max-w-xs">
                            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
                            <div className="flex flex-col items-start">
                                <span className="text-xs text-muted-foreground">Previous</span>
                                <span className="truncate">{previousResourceTitle || '...'}</span>
                            </div>
                        </Link>
                    </Button>
                    
                    {nextResourceId ? (
                        <Button 
                            variant="outline" 
                            asChild 
                            disabled={!isCompleted}
                            title={!isCompleted ? "Complete this lesson to proceed" : ""}
                        >
                            <Link href={`/lms/courses/${courseId}/${nextResourceId}`} className="max-w-xs">
                                 <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">Next</span>
                                    <span className="truncate">{nextResourceTitle || '...'}</span>
                                </div>
                                <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="outline" disabled={true} className="max-w-xs">
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground">End of course</span>
                            </div>
                            <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
