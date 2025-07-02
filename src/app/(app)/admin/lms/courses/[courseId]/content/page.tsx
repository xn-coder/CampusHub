
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Trash2, BookOpen, Video, FileText, Users, Loader2 } from 'lucide-react';
import type { Course, CourseResource, CourseResourceType } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { 
  getCourseContentForAdminAction,
  addResourceToCourseAction,
  deleteCourseResourceAction
} from '../../actions';

type ResourceTabKey = 'ebook' | 'video' | 'note' | 'webinar';

export default function ManageCourseContentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [resources, setResources] = useState<CourseResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resource Form State
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceTabKey>('note');
  const [resourceUrlOrContent, setResourceUrlOrContent] = useState('');

  const fetchCourseData = async () => {
    setIsLoading(true);
    const result = await getCourseContentForAdminAction(courseId);
    if (result.ok) {
      setCourse(result.course || null);
      setResources(result.resources || []);
    } else {
      toast({ title: "Error", description: result.message || "Failed to load course details.", variant: "destructive" });
      router.push('/admin/lms/courses');
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const resetResourceForm = () => {
    setResourceTitle('');
    setResourceUrlOrContent('');
    setResourceType('note');
  };

  const handleAddResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceUrlOrContent.trim()) {
      toast({ title: "Error", description: "Title and Content/URL are required for the resource.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const result = await addResourceToCourseAction({
      course_id: courseId,
      title: resourceTitle.trim(),
      type: resourceType,
      url_or_content: resourceUrlOrContent.trim(),
    });

    if (result.ok) {
      toast({ title: "Resource Added" });
      resetResourceForm();
      await fetchCourseData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteResource = async (resourceId: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
        setIsSubmitting(true);
        const result = await deleteCourseResourceAction(resourceId);
        if (result.ok) {
            toast({ title: "Resource Deleted", variant: "destructive" });
            await fetchCourseData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Loading course details...</div>;
  }
  if (!course) {
    return <div className="text-center py-10 text-destructive">Course not found. It might have been deleted.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Manage Content: ${course.title}`} description="Add, edit, or remove resources for this course." />
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Resource</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <Label htmlFor="resource-title">Resource Title</Label>
                <Input id="resource-title" value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} placeholder="e.g., Chapter 1 PDF" disabled={isSubmitting} />
              </div>
              <div>
                <Label>Resource Type</Label>
                <RadioGroup value={resourceType} onValueChange={(val) => setResourceType(val as ResourceTabKey)} className="flex space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="note" id="type-note" /><Label htmlFor="type-note">Note</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="video" id="type-video" /><Label htmlFor="type-video">Video</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="ebook" id="type-ebook" /><Label htmlFor="type-ebook">E-book</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="webinar" id="type-webinar" /><Label htmlFor="type-webinar">Webinar</Label></div>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="resource-content">{resourceType === 'note' ? 'Content' : 'URL'}</Label>
                <Textarea id="resource-content" value={resourceUrlOrContent} onChange={e => setResourceUrlOrContent(e.target.value)} placeholder={resourceType === 'note' ? 'Enter text content...' : 'Enter full URL...'} disabled={isSubmitting} />
              </div>
               <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} 
                Add Resource
              </Button>
            </form>
          </CardContent>
        </Card>
      
        <Card>
          <CardHeader>
            <CardTitle>Existing Resources</CardTitle>
            <CardDescription>All resources currently in this course.</CardDescription>
          </CardHeader>
          <CardContent>
            {resources.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                  {resources.map(resource => (
                    <li key={resource.id} className="flex justify-between items-center p-2 border rounded-md bg-background">
                      <div className="truncate">
                          <p className="font-medium truncate" title={resource.title}>{resource.title}</p>
                          <p className="text-xs text-muted-foreground">{resource.type}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteResource(resource.id)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </li>
                  ))}
                </ul>
             ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No resources added to this course yet.</p>
             )}
          </CardContent>
        </Card>
      </div>
      <Button variant="outline" onClick={() => router.push('/admin/lms/courses')} className="mt-4 self-start" disabled={isSubmitting}>
        Back to Courses
      </Button>
    </div>
  );
}
