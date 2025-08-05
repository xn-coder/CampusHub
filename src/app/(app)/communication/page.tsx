
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnnouncementDB as Announcement, UserRole, ClassData, Student, Exam, SchoolEntry } from '@/types';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { PlusCircle, Send, Loader2, Link as LinkIcon, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { postAnnouncementAction, getAnnouncementsAction, getExamDetailsForLinkingAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


interface GetAnnouncementsParams {
  school_id?: string | null;
  user_role: UserRole;
  user_id?: string;
  student_user_id?: string;
  teacher_class_ids?: string[];
}


function CommunicationPageForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ 
    title: '', 
    content: '', 
    authorName: '', 
    targetClassId: '', 
    targetAudience: 'all' as 'students' | 'teachers' | 'all',
    linkedExamId: '' 
  });
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isContextLoading, setIsContextLoading] = useState(true); 
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<ClassData[]>([]);
  const [allSchoolClasses, setAllSchoolClasses] = useState<ClassData[]>([]);


  useEffect(() => { 
    async function loadUserAndSchoolContext() {
      setIsContextLoading(true);
      let fetchedRole: UserRole | null = null;
      let fetchedUserId: string | null = null;
      let fetchedSchoolId: string | null = null;

      if (typeof window !== 'undefined') {
        fetchedRole = localStorage.getItem('currentUserRole') as UserRole | null;
        fetchedUserId = localStorage.getItem('currentUserId');
        setCurrentUserRole(fetchedRole);
        setCurrentUserId(fetchedUserId);

        if (fetchedUserId) {
          const { data: userRec, error: userErr } = await supabase
            .from('users')
            .select('id, name, email, role, school_id')
            .eq('id', fetchedUserId)
            .single();
          
          if (userErr || !userRec) {
            toast({title: "Error", description: "Could not load user context.", variant: "destructive"});
            setIsContextLoading(false);
            return;
          }
          fetchedSchoolId = userRec.school_id;
          setCurrentSchoolId(fetchedSchoolId);
          setNewAnnouncement(prev => ({ ...prev, authorName: userRec.name }));

          if (fetchedSchoolId) {
            if (fetchedRole === 'teacher') {
              const { data: teacherProfile, error: teacherProfileError } = await supabase
                  .from('teachers').select('id').eq('user_id', fetchedUserId).single();
              if (teacherProfile) {
                   const { data: classesData, error: classesError } = await supabase
                      .from('classes')
                      .select('id, name, division')
                      .eq('teacher_id', teacherProfile.id)
                      .eq('school_id', fetchedSchoolId);
                  if (classesError) toast({title: "Error", description: "Failed to fetch teacher's classes.", variant: "destructive"});
                  else setTeacherAssignedClasses(classesData || []);
              }
            } else if (fetchedRole === 'admin') {
                const { data: classesData, error: classesError } = await supabase
                    .from('classes')
                    .select('id, name, division')
                    .eq('school_id', fetchedSchoolId);
                if (classesError) toast({title: "Error", description: "Failed to fetch school classes for admin.", variant: "destructive"});
                else setAllSchoolClasses(classesData || []);
            }
          }
        }
      }
      setIsContextLoading(false);
    }
    loadUserAndSchoolContext();
  }, [toast]);
  
  const prefillFromUrl = useCallback(() => {
    const examId = searchParams.get('examId');
    const examName = searchParams.get('examName');
    const targetClassId = searchParams.get('targetClassId');

    if (examId && examName && targetClassId) {
        setShowForm(true);
        setNewAnnouncement(prev => ({
            ...prev,
            title: `Re-exam Notification: ${examName}`,
            content: `This is to inform all eligible students that a re-exam for "${examName}" has been scheduled.\n\nPlease contact the school administration or your class teacher for further details regarding the exact schedule and registration process.`,
            linkedExamId: examId,
            targetClassId: targetClassId,
            targetAudience: 'students',
        }));
    }
  }, [searchParams]);

  useEffect(() => {
    prefillFromUrl();
  }, [prefillFromUrl]);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (isContextLoading || !currentUserRole || !currentUserId) return;

      setIsLoading(true); 
      
      const params: GetAnnouncementsParams = {
        school_id: currentSchoolId,
        user_role: currentUserRole,
        user_id: currentUserId,
        student_user_id: currentUserRole === 'student' ? currentUserId : undefined,
        teacher_class_ids: teacherAssignedClasses.map(c => c.id),
      };
      
      const result = await getAnnouncementsAction(params);
      if (result.ok && result.announcements) {
        setAllAnnouncements(result.announcements);
      } else {
        toast({ title: "Error", description: result.message || "Failed to fetch announcements.", variant: "destructive" });
        setAllAnnouncements([]);
      }
      setIsLoading(false);
    }
    
    fetchAnnouncements();

  }, [currentSchoolId, currentUserRole, currentUserId, teacherAssignedClasses, toast, isContextLoading]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof typeof newAnnouncement) => (value: string) => {
    setNewAnnouncement(prev => ({ ...prev, [name]: value === "none" ? "" : value }));
  };
  
   const handleRadioChange = (name: keyof typeof newAnnouncement) => (value: 'students' | 'teachers' | 'all') => {
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };


  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !currentUserRole) {
      toast({ title: "Error", description: "User context is missing. Cannot post.", variant: "destructive" });
      return;
    }
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim() || !newAnnouncement.authorName.trim()) {
      toast({title: "Error", description: "Title, Content, and Author Name are required.", variant: "destructive"});
      return;
    }
    
    const schoolIdForPost = currentUserRole === 'superadmin' ? null : currentSchoolId;

    if (!schoolIdForPost && currentUserRole !== 'superadmin') {
      toast({ title: "Error", description: "School context is required to post an announcement.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const result = await postAnnouncementAction({
      ...newAnnouncement,
      posted_by_user_id: currentUserId,
      posted_by_role: currentUserRole,
      school_id: schoolIdForPost
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Announcement Posted", description: `${newAnnouncement.title} has been posted.` });
      
      const params: GetAnnouncementsParams = {
        school_id: currentSchoolId,
        user_role: currentUserRole,
        user_id: currentUserId,
        student_user_id: currentUserRole === 'student' ? currentUserId : undefined,
        teacher_class_ids: teacherAssignedClasses.map(c => c.id),
      };
      const fetchResult = await getAnnouncementsAction(params);
      if (fetchResult.ok && fetchResult.announcements) setAllAnnouncements(fetchResult.announcements);

      setNewAnnouncement(prev => ({ title: '', content: '', authorName: prev.authorName, targetClassId: '', targetAudience: 'all', linkedExamId: '' })); 
      setShowForm(false);
    } else {
      toast({ title: "Error", description: result.message || "Failed to post announcement.", variant: "destructive" });
    }
  };

  const canPostAnnouncement = (currentUserRole === 'admin' || currentUserRole === 'teacher' || currentUserRole === 'superadmin');
  const availableClassesForTargeting = currentUserRole === 'admin' ? allSchoolClasses : teacherAssignedClasses;
  
  const isClassTargetingDisabled = isSubmitting 
    || availableClassesForTargeting.length === 0 
    || !!newAnnouncement.linkedExamId 
    || (currentUserRole === 'admin' && newAnnouncement.targetAudience === 'teachers');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Announcements" 
        description="Share and view important updates."
        actions={
          canPostAnnouncement ? ( 
            <Button onClick={() => setShowForm(prev => !prev)} disabled={isSubmitting || isContextLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'New Announcement'}
            </Button>
          ) : null
        }
      />

      {isContextLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/>Loading user context...</CardContent></Card>}

      {showForm && canPostAnnouncement && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Announcement</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmitAnnouncement}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" value={newAnnouncement.title} onChange={handleInputChange} placeholder="Announcement Title" required disabled={isSubmitting}/>
              </div>
               <div>
                <Label htmlFor="authorName">Author Name / Department</Label>
                <Input id="authorName" name="authorName" value={newAnnouncement.authorName} onChange={handleInputChange} placeholder="e.g., Principal's Office, Your Name" required disabled={isSubmitting}/>
              </div>
              
              {currentUserRole === 'admin' && (
                 <div>
                    <Label>Target Audience</Label>
                    <RadioGroup value={newAnnouncement.targetAudience} onValueChange={handleRadioChange('targetAudience')} className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                       <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="target-all"/><Label htmlFor="target-all">All Users</Label></div>
                       <div className="flex items-center space-x-2"><RadioGroupItem value="students" id="target-students"/><Label htmlFor="target-students">Students Only</Label></div>
                       <div className="flex items-center space-x-2"><RadioGroupItem value="teachers" id="target-teachers"/><Label htmlFor="target-teachers">Teachers Only</Label></div>
                    </RadioGroup>
                 </div>
              )}

              {(currentUserRole === 'admin' || currentUserRole === 'teacher') && (
                <div>
                  <Label htmlFor="targetClassId">Target Specific Class (Optional)</Label>
                  <Select 
                    value={newAnnouncement.targetClassId || "none"} 
                    onValueChange={handleSelectChange('targetClassId')} 
                    disabled={isClassTargetingDisabled}
                  >
                    <SelectTrigger id="targetClassId">
                      <SelectValue placeholder="General Announcement (School-wide)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General (School-wide, respecting audience filter)</SelectItem>
                      {availableClassesForTargeting.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Leave as "General" to send to all selected audience members, or pick a class to override.</p>
                </div>
              )}
               {currentUserRole === 'superadmin' && (
                <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                    You are posting as Super Admin. This announcement will be visible only to all school owners (Admins).
                </div>
              )}

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea id="content" name="content" value={newAnnouncement.content} onChange={handleInputChange} placeholder="Write your announcement here..." required rows={5} disabled={isSubmitting}/>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} 
                Post Announcement
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {isLoading && !isContextLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/>Loading announcements...</CardContent></Card>}
      
      {!isLoading && !isContextLoading && !currentSchoolId && (currentUserRole !== 'superadmin') && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Please ensure you are associated with a school to view or post announcements.</CardContent></Card>
      )}
      
      {!isLoading && !isContextLoading && (currentUserRole) && (
        <div className="space-y-6">
          {allAnnouncements.length > 0 ? allAnnouncements.map(announcement => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle>{announcement.title}</CardTitle>
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Posted by {announcement.author_name || announcement.posted_by?.name || 'System'} ({announcement.posted_by_role})</span>
                    <span>{format(parseISO(announcement.date), 'PPpp')}</span>
                    {announcement.school_id === null ? (
                        <Badge variant="secondary">Global Announcement</Badge>
                    ) : announcement.target_class ? (
                        <Badge variant="outline">For Class: {announcement.target_class.name} - {announcement.target_class.division}</Badge>
                    ) : null }
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{announcement.content}</p>
              </CardContent>
            </Card>
          )) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">No announcements relevant to you at this time.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


export default function CommunicationPage() {
  return (
    <Suspense>
      <CommunicationPageForm/>
    </Suspense>
  );
}
