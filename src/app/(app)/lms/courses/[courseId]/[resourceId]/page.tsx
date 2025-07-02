
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCourseForViewingAction } from '../actions';
import type { LessonContentResource } from '@/types';
import { Loader2, ArrowLeft, BookOpen, Video, FileText, Users, FileQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PageHeader from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

export default function CourseResourcePage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const resourceId = params.resourceId as string;

    const [resource, setResource] = useState<LessonContentResource | null>(null);
    const [courseTitle, setCourseTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (courseId && resourceId) {
            getCourseForViewingAction(courseId).then(result => {
                if (result.ok && result.course) {
                    setCourseTitle(result.course.title);
                    let foundResource: LessonContentResource | undefined;
                    // Find the resource within the course data
                    for (const lesson of result.course.resources) {
                        if (lesson.type === 'note') { // Lessons are 'note' type
                            try {
                                const contents = JSON.parse(lesson.url_or_content || '[]') as LessonContentResource[];
                                foundResource = contents.find(r => r.id === resourceId);
                                if (foundResource) break;
                            } catch (e) {
                                console.error("Failed to parse lesson content", e);
                            }
                        }
                    }

                    if (foundResource) {
                        setResource(foundResource);
                    } else {
                        setError("The requested resource could not be found in this course.");
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
                <CardContent>
                    {resource.type === 'video' && resource.url_or_content && (
                        <video controls autoPlay src={resource.url_or_content} className="w-full rounded-md aspect-video bg-black">
                          Your browser does not support the video tag.
                        </video>
                    )}
                    {resource.type === 'note' && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.url_or_content}</p>
                    )}
                    {resource.type === 'ebook' && resource.url_or_content && (
                        <iframe src={resource.url_or_content} className="w-full h-full min-h-[70vh] border-0" title={resource.title}>
                            <p>Your browser does not support embedded documents. Please use the link below to view it.</p>
                            <a href={resource.url_or_content} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                View E-book
                            </a>
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
            </Card>
        </div>
    );
}
