
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users } from 'lucide-react';
import type { Course, CourseResource } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';
type ResourceType = 'ebooks' | 'videos' | 'notes' | 'webinars';

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ResourceType>('ebooks');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');

  useEffect(() => {
    if (courseId && typeof window !== 'undefined') {
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      const courses: Course[] = storedCourses ? JSON.parse(storedCourses) : [];
      const foundCourse = courses.find(c => c.id === courseId);
      if (foundCourse) {
        setCourse(foundCourse);
      } else {
        toast({ title: "Error", description: "Course not found.", variant: "destructive" });
        router.push('/admin/lms/courses');
      }
      setIsLoading(false);
    }
  }, [courseId, router, toast]);

  const updateCourseInStorage = (updatedCourse: Course) => {
    const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
    let courses: Course[] = storedCourses ? JSON.parse(storedCourses) : [];
    courses = courses.map(c => c.id === updatedCourse.id ? updatedCourse : c);
    localStorage.setItem(MOCK_LMS_COURSES_KEY, JSON.stringify(courses));
    setCourse(updatedCourse); // Update local state
  };

  const handleAddResource = (e: FormEvent) => {
    e.preventDefault();
    if (!course || !resourceTitle.trim() || !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "Title and URL/Content are required.", variant: "destructive" });
      return;
    }

    const newResource: CourseResource = {
      id: `res-${uuidv4()}`,
      title: resourceTitle.trim(),
      type: activeTab.slice(0, -1) as CourseResource['type'], // 'ebooks' -> 'ebook'
      urlOrContent: resourceUrlOrContent.trim(),
    };

    const updatedCourse = { ...course };
    if (!updatedCourse.resources) {
      updatedCourse.resources = { ebooks: [], videos: [], notes: [], webinars: [] };
    }
    if (!updatedCourse.resources[activeTab]) {
        updatedCourse.resources[activeTab] = [];
    }
    updatedCourse.resources[activeTab].push(newResource);
    
    updateCourseInStorage(updatedCourse);
    toast({ title: "Resource Added", description: `${newResource.title} added to ${activeTab}.` });
    setResourceTitle('');
    setResourceUrlOrContent('');
  };

  const handleDeleteResource = (resourceId: string) => {
    if (!course) return;
    if (confirm("Are you sure you want to delete this resource?")) {
      const updatedCourse = { ...course };
      updatedCourse.resources[activeTab] = updatedCourse.resources[activeTab].filter(res => res.id !== resourceId);
      updateCourseInStorage(updatedCourse);
      toast({ title: "Resource Deleted", variant: "destructive" });
    }
  };
  
  const getResourceTypeLabel = (type: ResourceType): string => {
    switch(type) {
        case 'ebooks': return 'E-Book';
        case 'videos': return 'Video';
        case 'notes': return 'Note';
        case 'webinars': return 'Webinar';
        default: return 'Resource';
    }
  }
  
  const getResourceInputType = (type: ResourceType): 'url' | 'textarea' => {
      return type === 'notes' ? 'textarea' : 'url';
  }
  
  const getResourcePlaceholder = (type: ResourceType): string => {
      if (type === 'notes') return 'Enter note content here...';
      if (type === 'webinars') return 'Enter webinar/meeting URL...';
      return 'Enter URL...';
  }


  if (isLoading) {
    return <div className="text-center py-10">Loading course content...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add, edit, or remove resources for this course." />
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ResourceType)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ebooks"><BookOpen className="mr-2 h-4 w-4" /> E-books</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" /> Videos</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="mr-2 h-4 w-4" /> Notes</TabsTrigger>
          <TabsTrigger value="webinars"><Users className="mr-2 h-4 w-4" /> Webinars</TabsTrigger>
        </TabsList>

        {['ebooks', 'videos', 'notes', 'webinars'].map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <CardTitle>Manage {getResourceTypeLabel(tabKey as ResourceType)}s</CardTitle>
                <CardDescription>Add or remove {tabKey.toLowerCase()} for this course.</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddResource}>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`${tabKey}-title`}>{getResourceTypeLabel(tabKey as ResourceType)} Title</Label>
                    <Input 
                      id={`${tabKey}-title`} 
                      value={resourceTitle} 
                      onChange={(e) => setResourceTitle(e.target.value)} 
                      placeholder={`Enter ${getResourceTypeLabel(tabKey as ResourceType).toLowerCase()} title`} 
                      required 
                      disabled={activeTab !== tabKey}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${tabKey}-content`}>
                        {getResourceInputType(tabKey as ResourceType) === 'url' ? 'URL' : 'Content'}
                    </Label>
                    {getResourceInputType(tabKey as ResourceType) === 'textarea' ? (
                        <Textarea 
                            id={`${tabKey}-content`} 
                            value={resourceUrlOrContent} 
                            onChange={(e) => setResourceUrlOrContent(e.target.value)} 
                            placeholder={getResourcePlaceholder(tabKey as ResourceType)} 
                            required 
                            rows={5}
                            disabled={activeTab !== tabKey}
                        />
                    ) : (
                        <Input 
                            id={`${tabKey}-content`} 
                            type="url"
                            value={resourceUrlOrContent} 
                            onChange={(e) => setResourceUrlOrContent(e.target.value)} 
                            placeholder={getResourcePlaceholder(tabKey as ResourceType)} 
                            required 
                            disabled={activeTab !== tabKey}
                        />
                    )}
                  </div>
                   <Button type="submit" disabled={activeTab !== tabKey || isLoading}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add {getResourceTypeLabel(tabKey as ResourceType)}
                  </Button>
                </CardContent>
              </form>
              <CardContent className="mt-6">
                <h4 className="font-medium mb-2">Existing {getResourceTypeLabel(tabKey as ResourceType)}s:</h4>
                {(course.resources?.[activeTab as ResourceType]?.length ?? 0) > 0 ? (
                  <ul className="space-y-2">
                    {course.resources[activeTab as ResourceType].map((res: CourseResource) => (
                      <li key={res.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{res.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{res.urlOrContent}</p>
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteResource(res.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No {tabKey.toLowerCase()} added yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
       <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4">
        Back to Courses
      </Button>
    </div>
  );
}
