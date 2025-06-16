
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
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users, Loader2, ExternalLink } from 'lucide-react';
import type { Course, CourseResource, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; // Still needed for course details
import { addCourseResourceAction, deleteCourseResourceAction, getCourseResourcesAction } from '../../actions';

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
  const [isLoadingResources, setIsLoadingResources] = useState(false);

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
    const { data, error } = await supabase // Client-side fetch for course details is fine if RLS allows admins to see courses
      .from('lms_courses')
      .select('*')
      .eq('id', courseId)
      .single();
    if (error || !data) {
      toast({ title: "Error", description: "Course not found or failed to load.", variant: "destructive" });
      router.push('/admin/lms/courses'); // Redirect if course itself can't be found
    } else {
      setCourse(data as Course);
    }
    setIsLoadingPage(false); // Page loading (course details) is done
  }
  
  async function fetchCourseResources() {
    if (!courseId) return;
    setIsLoadingResources(true);
    const result = await getCourseResourcesAction(courseId);
    if (result.ok && result.resources) {
        setCourseResources(result.resources);
    } else {
        toast({title: "Error Loading Resources", description: result.message || "Failed to load course resources.", variant: "destructive"});
        setCourseResources([]);
    }
    setIsLoadingResources(false);
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
      fetchCourseResources(); 
    } else {
      toast({ title: "Error Adding Resource", description: result.message, variant: "destructive" });
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
        fetchCourseResources(); 
      } else {
        toast({ title: "Error Deleting Resource", description: result.message, variant: "destructive" });
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
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course details...</div>;
  }

  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found. It might have been deleted.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add, edit, or remove resources for this course." />
      
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as ResourceTabKey);
        setResourceTitle(''); 
        setResourceUrlOrContent('');
      }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
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
                <h4 className="text-lg font-medium mb-2">Existing {getResourceTypeLabel(tabKey as ResourceTabKey)}s ({isLoadingResources ? 'loading...' : displayedResources.length}):</h4>
                {isLoadingResources ? (
                    <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading resources...</div>
                ) : displayedResources.length > 0 ? (
                  <ul className="space-y-3 max-h-96 overflow-y-auto">
                    {displayedResources.map((res: CourseResource) => (
                      <li key={res.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" title={res.title}>{res.title}</p>
                          {res.type === 'note' ? (
                             <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 mt-1 rounded-sm max-h-24 overflow-y-auto">
                                {res.url_or_content}
                             </div>
                          ) : (
                            <a 
                                href={res.url_or_content} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-primary hover:underline flex items-center truncate"
                                title={res.url_or_content}
                            >
                                {res.url_or_content} <ExternalLink className="ml-1 h-3 w-3 shrink-0"/>
                            </a>
                          )}
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteResource(res.id)} disabled={isSubmitting} className="ml-2 shrink-0">
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No {tabKey.toLowerCase()} added yet for this course.</p>
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
