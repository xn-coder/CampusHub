"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCourseForViewingAction } from '../actions';
import type { LessonContentResource } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import PageHeader from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CourseResourcePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;

    const [resource, setResource] = useState<LessonContentResource | null>(null);
    const [courseTitle, setCourseTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New state for navigation
    const [previousResourceId, setPreviousResourceId] = useState<string | null>(null);
    const [nextResourceId, setNextResourceId] = useState<string | null>(null);
    const [previousResourceTitle, setPreviousResourceTitle] = useState<string | null>(null);
    const [nextResourceTitle, setNextResourceTitle] = useState<string | null>(null);


    useEffect(() => {
        if (courseId && resourceId) {
            setIsLoading(true); // Set loading true at the start of fetch
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
                        setResource(allFlattenedResources[currentIndex]);
                        
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
                    <CardTitle className="flex items-center">
                        {getResourceIcon(resource.type)}
                        {resource.title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="min-h-[60vh]">
                    {resource.type === 'video' && resource.url_or_content && (
                        <video controls autoPlay src={resource.url_or_content} className="w-full rounded-md aspect-video bg-black">
                          Your browser does not support the video tag.
                        </video>
                    )}
                    {resource.type === 'note' && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.url_or_content}</p>
                    )}
                    {(resource.type === 'ebook' || (resource.url_or_content && resource.url_or_content.endsWith('.pdf'))) && resource.url_or_content && (
                        <iframe src={resource.url_or_content} className="w-full h-full min-h-[70vh] border-0" title={resource.title}>
                            <p>Your browser does not support embedded documents. Please use the link below to view it.</p>
                            <Button asChild variant="link">
                                <a href={resource.url_or_content} target="_blank" rel="noopener noreferrer">
                                    View E-book in new tab
                                </a>
                            </Button>
                        </iframe>
                    )}
                    {resource.type === 'webinar' && resource.url_or_content && (
                         <Button variant="link" className="text-lg p-0 h-auto" onClick={() => window.open(resource.url_or_content, '_blank', 'noopener,noreferrer')}>
                            <Users className="mr-2 h-5 w-5"/> Click here to join the Webinar
                        </Button>
                    )}
                    {resource.type === 'quiz' && (
                        <div>
                            <p>Quiz functionality will be displayed here.</p>
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
                    <Button variant="outline" asChild disabled={!nextResourceId}>
                        <Link href={nextResourceId ? `/lms/courses/${courseId}/${nextResourceId}` : '#'} className="max-w-xs">
                             <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground">Next</span>
                                <span className="truncate">{nextResourceTitle || '...'}</span>
                            </div>
                            <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
