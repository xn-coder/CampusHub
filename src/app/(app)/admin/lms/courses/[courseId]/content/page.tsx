
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users, Loader2, ExternalLink, Eye } from 'lucide-react';
import type { Course, CourseResource, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient'; 
import { addCourseResourceAction, deleteCourseResourceAction, getCourseResourcesAction, addCourseFileResourceAction } from '../../actions';
import PdfViewer from '@/components/shared/pdf-viewer';

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

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ResourceTabKey>('ebooks');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [videoUploadMethod, setVideoUploadMethod] = useState<'url' | 'file'>('url');
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

  const handleOpenPreview = (url: string) => {
    setPreviewUrl(url);
    setIsPreviewOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_FILE_SIZE_MB = 4.5;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        const message = activeTab === 'videos'
          ? `The maximum file size is ${MAX_FILE_SIZE_MB} MB. For larger videos, please use the URL option.`
          : `The maximum file size is ${MAX_FILE_SIZE_MB} MB.`;
        toast({
          title: "File is too large",
          description: message,
          variant: "destructive",
        });
        setResourceFile(null);
        e.target.value = '';
        return;
      }

      const allowedTypes = {
        ebooks: ['application/pdf'],
        videos: ['video/mp4', 'video/webm', 'video/ogg'],
      };
      const currentAllowedTypes = allowedTypes[activeTab as keyof typeof allowedTypes] || [];
      if (!currentAllowedTypes.includes(file.type)) {
        toast({ title: "Invalid File Type", description: `Please select a valid file type for ${activeTab}.`, variant: "destructive" });
        setResourceFile(null);
        e.target.value = '';
        return;
      }
      setResourceFile(file);
    } else {
      setResourceFile(null);
    }
  };

  const handleAddResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!course || !resourceTitle.trim()) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    try {
      let result;
      const isFileUpload = (activeTab === 'ebooks') || (activeTab === 'videos' && videoUploadMethod === 'file');

      if (isFileUpload) {
          if (!resourceFile) {
              toast({ title: "Error", description: `A file is required for this upload method.`, variant: "destructive" });
              return;
          }
          const formData = new FormData();
          formData.append('resourceFile', resourceFile);
          formData.append('courseId', course.id);
          formData.append('title', resourceTitle.trim());
          formData.append('type', resourceTypeMapping[activeTab]);

          result = await addCourseFileResourceAction(formData);

      } else {
          if (!resourceUrlOrContent.trim()) {
              toast({ title: "Error", description: "URL/Content is required for this resource type.", variant: "destructive" });
              return;
          }
          result = await addCourseResourceAction({
              course_id: course.id,
              title: resourceTitle.trim(),
              type: resourceTypeMapping[activeTab],
              url_or_content: resourceUrlOrContent.trim(),
          });
      }

      if (result.ok) {
        toast({ title: "Resource Added", description: result.message });
        setResourceTitle('');
        setResourceUrlOrContent('');
        setResourceFile(null);
        const fileInput = document.getElementById(`${activeTab}-content-file-input`) as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        fetchCourseResources(); 
      } else {
        toast({ title: "Error Adding Resource", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Unexpected Error", description: "An unexpected error occurred during the upload.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
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
        setResourceFile(null);
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
                    {tabKey === 'ebooks' ? (
                      <>
                        <Label htmlFor={`${tabKey}-content-file-input`}>PDF File</Label>
                        <Input
                          id={`${tabKey}-content-file-input`}
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          required
                          disabled={isSubmitting}
                        />
                         <p className="text-xs text-muted-foreground mt-1">
                            Max file size: 4.5 MB.
                         </p>
                      </>
                    ) : tabKey === 'videos' ? (
                        <>
                        <Label>Video Source</Label>
                        <RadioGroup value={videoUploadMethod} onValueChange={(val) => setVideoUploadMethod(val as 'url' | 'file')} className="flex space-x-4 mb-2">
                           <div className="flex items-center space-x-2">
                                <RadioGroupItem value="url" id="video-url" />
                                <Label htmlFor="video-url">URL (e.g., YouTube)</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <RadioGroupItem value="file" id="video-file" />
                                <Label htmlFor="video-file">Upload File</Label>
                            </div>
                        </RadioGroup>
                        {videoUploadMethod === 'url' ? (
                             <Input
                                key="video-url-input" 
                                id={`${tabKey}-content`} 
                                type="url"
                                value={resourceUrlOrContent} 
                                onChange={(e) => setResourceUrlOrContent(e.target.value)} 
                                placeholder="Enter video URL..." 
                                required 
                                disabled={isSubmitting}
                            />
                        ) : (
                             <>
                                <Input
                                    key="video-file-input"
                                    id={`${tabKey}-content-file-input`}
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    required
                                    disabled={isSubmitting}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Max file size: 4.5 MB. For larger videos, please use the "URL" option.
                                </p>
                             </>
                        )}
                        </>
                    ) : (
                      <>
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
                      </>
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
                          {res.type === 'note' && !res.file_name ? (
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
                                {res.file_name || res.url_or_content} <ExternalLink className="ml-1 h-3 w-3 shrink-0"/>
                            </a>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          {res.type === 'ebook' && res.url_or_content && (
                            <Button variant="outline" size="icon" title="Preview E-book" onClick={() => handleOpenPreview(res.url_or_content)} disabled={isSubmitting}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="destructive" size="icon" title="Delete Resource" onClick={() => handleDeleteResource(res.id)} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
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

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>E-Book Preview</DialogTitle>
          </DialogHeader>
          <div className="h-full w-full overflow-hidden">
            {previewUrl ? (
                <PdfViewer fileUrl={previewUrl} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p>No URL to preview.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
