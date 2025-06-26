
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnnouncementDB as Announcement, UserRole, ClassData, Student, Exam } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Send, Loader2, Link as LinkIcon, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { postAnnouncementAction, getAnnouncementsAction, getExamDetailsForLinkingAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'next/navigation';

interface GetAnnouncementsParams {
  school_id?: string | null;
  user_role: UserRole;
  user_id?: string;
  student_class_id?: string | null;
  teacher_class_ids?: string[];
}


export default function CommunicationPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', authorName: '', targetClassId: '', linkedExamId: '' });
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [isContextLoading, setIsContextLoading] = useState(true); 
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);

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
            } else if (fetchedRole === 'student') {
              const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*') 
                .eq('user_id', fetchedUserId) 
                .single();
              if (studentError || !studentData) toast({title: "Error", description: "Could not load student profile.", variant: "destructive"});
              else setStudentProfile(studentData as Student);
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
    if (examId) {
        getExamDetailsForLinkingAction(examId).then(result => {
            if (result.ok && result.exam) {
                const exam = result.exam;
                setShowForm(true); // Automatically open the form
                setNewAnnouncement(prev => ({
                    ...prev,
                    title: `Notification for Exam: ${exam.name}`,
                    content: `This is an official notification regarding an upcoming exam.`,
                    linkedExamId: exam.id,
                    targetClassId: exam.class_id || '', // Pre-select the target class
                }));
            } else {
                toast({ title: "Error", description: "Could not fetch details for the linked exam.", variant: "destructive"});
            }
        });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    prefillFromUrl();
  }, [prefillFromUrl]);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (isContextLoading || !currentUserRole) return; 

      setIsLoading(true); 
      
      const params: GetAnnouncementsParams = {
        school_id: currentSchoolId,
        user_role: currentUserRole,
        user_id: currentUserId || undefined,
        student_class_id: studentProfile?.class_id || null, 
        teacher_class_ids: teacherAssignedClasses.map(c => c.id),
      };
      
      const canFetch = currentUserRole === 'superadmin' || (currentUserRole && currentSchoolId);

      if (canFetch) {
        const result = await getAnnouncementsAction(params);
        if (result.ok && result.announcements) {
          setAllAnnouncements(result.announcements);
        } else {
          toast({ title: "Error", description: result.message || "Failed to fetch announcements.", variant: "destructive" });
          setAllAnnouncements([]);
        }
      } else if (currentUserRole && currentUserRole !== 'superadmin' && !currentSchoolId) {
         toast({ title: "Info", description: "No school association found. Cannot load announcements.", variant: "default" });
         setAllAnnouncements([]);
      }
      setIsLoading(false);
    }
    
    fetchAnnouncements();

  }, [currentSchoolId, currentUserRole, currentUserId, studentProfile, teacherAssignedClasses, toast, isContextLoading]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: 'targetClassId') => (value: string) => {
    setNewAnnouncement(prev => ({ ...prev, [name]: value === "none" ? "" : value }));
  };

  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !currentUserRole || !currentSchoolId) {
      toast({ title: "Error", description: "User or school context is missing. Cannot post.", variant: "destructive" });
      return;
    }
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim() || !newAnnouncement.authorName.trim()) {
      toast({title: "Error", description: "Title, Content, and Author Name are required.", variant: "destructive"});
      return;
    }
    
    setIsSubmitting(true);
    const result = await postAnnouncementAction({
      title: newAnnouncement.title.trim(),
      content: newAnnouncement.content.trim(),
      author_name: newAnnouncement.authorName.trim(),
      posted_by_user_id: currentUserId,
      posted_by_role: currentUserRole,
      target_class_id: newAnnouncement.targetClassId || undefined,
      school_id: currentSchoolId,
      linked_exam_id: newAnnouncement.linkedExamId || undefined,
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Announcement Posted", description: `${newAnnouncement.title} has been posted.` });
      
      if (currentUserRole && (currentSchoolId || currentUserRole === 'superadmin')) {
          const params: GetAnnouncementsParams = {
            school_id: currentSchoolId,
            user_role: currentUserRole,
            user_id: currentUserId || undefined,
            student_class_id: studentProfile?.class_id || null,
            teacher_class_ids: teacherAssignedClasses.map(c => c.id),
        };
        const fetchResult = await getAnnouncementsAction(params);
        if (fetchResult.ok && fetchResult.announcements) setAllAnnouncements(fetchResult.announcements);
      }

      setNewAnnouncement(prev => ({ title: '', content: '', authorName: prev.authorName, targetClassId: '', linkedExamId: '' })); 
      setShowForm(false);
    } else {
      toast({ title: "Error", description: result.message || "Failed to post announcement.", variant: "destructive" });
    }
  };

  const canPostAnnouncement = (currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'teacher') && !!currentSchoolId;
  const availableClassesForTargeting = currentUserRole === 'admin' ? allSchoolClasses : teacherAssignedClasses;

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
              
              {(currentUserRole === 'teacher' || currentUserRole === 'admin') && (
                <div>
                  <Label htmlFor="targetClassId">Target Specific Class (Optional)</Label>
                  <Select value={newAnnouncement.targetClassId || "none"} onValueChange={handleSelectChange('targetClassId')} disabled={isSubmitting || availableClassesForTargeting.length === 0 || !!newAnnouncement.linkedExamId}>
                    <SelectTrigger id="targetClassId">
                      <SelectValue placeholder="General Announcement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General Announcement</SelectItem>
                      {availableClassesForTargeting.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">If not specified, this will be a school-wide announcement.</p>
                </div>
              )}

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea id="content" name="content" value={newAnnouncement.content} onChange={handleInputChange} placeholder="Write your announcement here..." required rows={5} disabled={isSubmitting}/>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || !currentSchoolId}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} 
                Post Announcement
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {isLoading && !isContextLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/>Loading announcements...</CardContent></Card>}
      
      {!isLoading && !isContextLoading && !currentSchoolId && currentUserRole !== 'superadmin' && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Please ensure you are associated with a school to view or post announcements.</CardContent></Card>
      )}
      
      {!isLoading && !isContextLoading && ((currentSchoolId && currentUserRole) || currentUserRole === 'superadmin') && (
        <div className="space-y-6">
          {allAnnouncements.length > 0 ? allAnnouncements.map(announcement => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle>{announcement.title}</CardTitle>
                <CardDescription>
                  Posted by {announcement.author_name || announcement.posted_by?.name || 'System'} ({announcement.posted_by_role}) on {format(parseISO(announcement.date), 'PPpp')}
                </CardDescription>
                {announcement.target_class && (
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400"> (For Class: {announcement.target_class.name} - {announcement.target_class.division})</span>
                )}
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
