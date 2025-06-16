
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
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users, Loader2 } from 'lucide-react';
import type { Course, CourseResource, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { addCourseResourceAction, deleteCourseResourceAction } from '../../actions';

type ResourceTabKey = 'ebooks' | 'videos' | 'notes' | 'webinars';
const resourceTypeMapping: Record<ResourceTabKey, CourseResourceType> = {
    ebooks: 'ebook',
    videos: 'video',
    notes: 'note',
    webinars: 'webinar',
};

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [courseResources, setCourseResources] = useState<CourseResource[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<ResourceTabKey>('ebooks');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');

  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
      fetchCourseResources();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function fetchCourseDetails() {
    setIsLoadingPage(true);
    const { data, error } = await supabase
      .from('lms_courses')
      .select('*')
      .eq('id', courseId)
      .single();
    if (error || !data) {
      toast({ title: "Error", description: "Course not found or failed to load.", variant: "destructive" });
      router.push('/admin/lms/courses');
    } else {
      setCourse(data as Course);
    }
    setIsLoadingPage(false);
  }
  
  async function fetchCourseResources() {
    const { data, error } = await supabase
        .from('lms_course_resources')
        .select('*')
        .eq('course_id', courseId);
    if (error) {
        toast({title: "Error", description: "Failed to load course resources.", variant: "destructive"});
        setCourseResources([]);
    } else {
        setCourseResources(data || []);
    }
  }


  const handleAddResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!course || !resourceTitle.trim() || !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "Title and URL/Content are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const result = await addCourseResourceAction({
      course_id: course.id,
      title: resourceTitle.trim(),
      type: resourceTypeMapping[activeTab],
      url_or_content: resourceUrlOrContent.trim(),
    });

    if (result.ok) {
      toast({ title: "Resource Added", description: result.message });
      setResourceTitle('');
      setResourceUrlOrContent('');
      fetchCourseResources(); // Re-fetch resources
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!course) return;
    if (confirm("Are you sure you want to delete this resource?")) {
      setIsSubmitting(true);
      const result = await deleteCourseResourceAction(resourceId, course.id);
      if (result.ok) {
        toast({ title: "Resource Deleted", variant: "destructive" });
        fetchCourseResources(); // Re-fetch resources
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
      setIsSubmitting(false);
    }
  };
  
  const getResourceTypeLabel = (type: ResourceTabKey): string => {
    switch(type) {
        case 'ebooks': return 'E-Book';
        case 'videos': return 'Video';
        case 'notes': return 'Note';
        case 'webinars': return 'Webinar';
        default: return 'Resource';
    }
  }
  
  const getResourceInputType = (type: ResourceTabKey): 'url' | 'textarea' => {
      return type === 'notes' ? 'textarea' : 'url';
  }
  
  const getResourcePlaceholder = (type: ResourceTabKey): string => {
      if (type === 'notes') return 'Enter note content here...';
      if (type === 'webinars') return 'Enter webinar/meeting URL...';
      return 'Enter URL...';
  }

  const displayedResources = courseResources.filter(res => res.type === resourceTypeMapping[activeTab]);


  if (isLoadingPage) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course content...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add, edit, or remove resources for this course." />
      
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as ResourceTabKey);
        setResourceTitle(''); // Reset form when tab changes
        setResourceUrlOrContent('');
      }} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ebooks"><BookOpen className="mr-2 h-4 w-4" /> E-books</TabsTrigger>
          <TabsTrigger value="videos"><Video className="mr-2 h-4 w-4" /> Videos</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="mr-2 h-4 w-4" /> Notes</TabsTrigger>
          <TabsTrigger value="webinars"><Users className="mr-2 h-4 w-4" /> Webinars</TabsTrigger>
        </TabsList>

        {(['ebooks', 'videos', 'notes', 'webinars'] as ResourceTabKey[]).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey}>
            <Card>
              <CardHeader>
                <CardTitle>Manage {getResourceTypeLabel(tabKey as ResourceTabKey)}s</CardTitle>
                <CardDescription>Add or remove {tabKey.toLowerCase()} for this course.</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddResource}>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`${tabKey}-title`}>{getResourceTypeLabel(tabKey as ResourceTabKey)} Title</Label>
                    <Input 
                      id={`${tabKey}-title`} 
                      value={resourceTitle} 
                      onChange={(e) => setResourceTitle(e.target.value)} 
                      placeholder={`Enter ${getResourceTypeLabel(tabKey as ResourceTabKey).toLowerCase()} title`} 
                      required 
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${tabKey}-content`}>
                        {getResourceInputType(tabKey as ResourceTabKey) === 'url' ? 'URL' : 'Content'}
                    </Label>
                    {getResourceInputType(tabKey as ResourceTabKey) === 'textarea' ? (
                        <Textarea 
                            id={`${tabKey}-content`} 
                            value={resourceUrlOrContent} 
                            onChange={(e) => setResourceUrlOrContent(e.target.value)} 
                            placeholder={getResourcePlaceholder(tabKey as ResourceTabKey)} 
                            required 
                            rows={5}
                            disabled={isSubmitting}
                        />
                    ) : (
                        <Input 
                            id={`${tabKey}-content`} 
                            type="url"
                            value={resourceUrlOrContent} 
                            onChange={(e) => setResourceUrlOrContent(e.target.value)} 
                            placeholder={getResourcePlaceholder(tabKey as ResourceTabKey)} 
                            required 
                            disabled={isSubmitting}
                        />
                    )}
                  </div>
                   <Button type="submit" disabled={isSubmitting || activeTab !== tabKey}>
                    {isSubmitting && activeTab === tabKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} 
                    Add {getResourceTypeLabel(tabKey as ResourceTabKey)}
                  </Button>
                </CardContent>
              </form>
              <CardContent className="mt-6">
                <h4 className="font-medium mb-2">Existing {getResourceTypeLabel(tabKey as ResourceTabKey)}s:</h4>
                {displayedResources.length > 0 ? (
                  <ul className="space-y-2">
                    {displayedResources.map((res: CourseResource) => (
                      <li key={res.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{res.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{res.url_or_content}</p>
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteResource(res.id)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No {tabKey.toLowerCase()} added yet for this course.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
       <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start" disabled={isSubmitting}>
        Back to Courses
      </Button>
    </div>
  );
}
