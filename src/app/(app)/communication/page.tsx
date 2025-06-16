
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnnouncementDB as Announcement, UserRole, ClassData, Student, User } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Send, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { postAnnouncementAction, getAnnouncementsAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';

export default function CommunicationPage() {
  const { toast } = useToast();
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', authorName: '', targetClassId: '' });
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<User | null>(null); 
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);

  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<ClassData[]>([]);
  const [adminAllSchoolClasses, setAdminAllSchoolClasses] = useState<ClassData[]>([]); // For admin to target specific classes

  useEffect(() => { 
    async function loadUserAndSchoolContext() {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        const userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId) {
          const { data: userRec, error: userErr } = await supabase
            .from('users')
            .select('id, name, email, role, school_id')
            .eq('id', userId)
            .single();
          
          if (userErr || !userRec) {
            toast({title: "Error", description: "Could not load user context.", variant: "destructive"});
            setIsLoading(false);
            return;
          }
          setCurrentUserInfo(userRec as User);
          setCurrentSchoolId(userRec.school_id);
          setNewAnnouncement(prev => ({ ...prev, authorName: userRec.name }));

          if (userRec.school_id) { // Only fetch classes if there's a school_id
            if (role === 'teacher') {
              const { data: teacherProfile, error: teacherProfileError } = await supabase
                  .from('teachers').select('id').eq('user_id', userId).single();
              if (teacherProfile) {
                   const { data: classesData, error: classesError } = await supabase
                      .from('classes')
                      .select('id, name, division')
                      .eq('teacher_id', teacherProfile.id)
                      .eq('school_id', userRec.school_id);
                  if (classesError) toast({title: "Error", description: "Failed to fetch teacher's classes.", variant: "destructive"});
                  else setTeacherAssignedClasses(classesData || []);
              }
            } else if (role === 'admin') {
                const { data: classesData, error: classesError } = await supabase
                    .from('classes')
                    .select('id, name, division')
                    .eq('school_id', userRec.school_id);
                if (classesError) toast({title: "Error", description: "Failed to fetch school classes for admin.", variant: "destructive"});
                else setAdminAllSchoolClasses(classesData || []);
            } else if (role === 'student') {
              const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('user_id', userId) 
                .single();
              if (studentError || !studentData) toast({title: "Error", description: "Could not load student profile.", variant: "destructive"});
              else setStudentProfile(studentData as Student);
            }
          }
        }
      }
      setIsLoading(false); 
    }
    loadUserAndSchoolContext();
  }, [toast]);

  useEffect(() => {
    async function fetchAnnouncements() {
      if (currentUserRole && (currentSchoolId || currentUserRole === 'superadmin')) {
        setIsLoading(true);
        const params: GetAnnouncementsParams = {
          school_id: currentSchoolId, // Will be null for superadmin if they don't have one
          user_role: currentUserRole,
          user_id: currentUserId || undefined,
          student_class_id: studentProfile?.class_id || undefined,
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
      } else if (!isLoading && currentUserRole && currentUserRole !== 'superadmin' && !currentSchoolId) {
         // Non-superadmin without school context can't see announcements
         setAllAnnouncements([]);
         setIsLoading(false);
      }
    }
    
    if (!isLoading) { // Ensure user context is loaded first
        fetchAnnouncements();
    }
  }, [currentSchoolId, currentUserRole, currentUserId, studentProfile, teacherAssignedClasses, toast, isLoading]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleTargetClassChange = (value: string) => {
    setNewAnnouncement(prev => ({ ...prev, targetClassId: value === "general" ? "" : value }));
  };

  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !currentUserRole || !currentSchoolId) { // Require school_id for posting
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
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Announcement Posted", description: `${newAnnouncement.title} has been posted.` });
      
      // Re-fetch announcements
      if (currentUserRole && (currentSchoolId || currentUserRole === 'superadmin')) {
          const params: GetAnnouncementsParams = {
            school_id: currentSchoolId,
            user_role: currentUserRole,
            user_id: currentUserId || undefined,
            student_class_id: studentProfile?.class_id || undefined,
            teacher_class_ids: teacherAssignedClasses.map(c => c.id),
        };
        const fetchResult = await getAnnouncementsAction(params);
        if (fetchResult.ok && fetchResult.announcements) setAllAnnouncements(fetchResult.announcements);
      }

      setNewAnnouncement(prev => ({ title: '', content: '', authorName: prev.authorName, targetClassId: '' })); 
      setShowForm(false);
    } else {
      toast({ title: "Error", description: result.message || "Failed to post announcement.", variant: "destructive" });
    }
  };

  const canPostAnnouncement = currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'teacher';
  const availableClassesForTargeting = currentUserRole === 'admin' ? adminAllSchoolClasses : teacherAssignedClasses;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Announcements" 
        description="Share and view important updates."
        actions={
          canPostAnnouncement && currentSchoolId ? ( 
            <Button onClick={() => setShowForm(prev => !prev)} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'New Announcement'}
            </Button>
          ) : null
        }
      />

      {showForm && canPostAnnouncement && currentSchoolId && (
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
              {(currentUserRole === 'teacher' || currentUserRole === 'admin') && availableClassesForTargeting.length > 0 && (
                <div>
                  <Label htmlFor="targetClassId">Target Specific Class (Optional)</Label>
                  <Select value={newAnnouncement.targetClassId} onValueChange={handleTargetClassChange} disabled={isSubmitting}>
                    <SelectTrigger id="targetClassId">
                      <SelectValue placeholder={`General Announcement for ${currentUserRole === 'teacher' ? 'Your Students' : 'the School'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Announcement</SelectItem>
                      {availableClassesForTargeting.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">If not specified, announcement is considered general for your role's scope.</p>
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

      {isLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block mr-2"/>Loading announcements...</CardContent></Card>}
      
      {!isLoading && !currentSchoolId && currentUserRole !== 'superadmin' && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Please ensure you are associated with a school to view or post announcements.</CardContent></Card>
      )}
      
      {!isLoading && ((currentSchoolId && currentUserRole) || currentUserRole === 'superadmin') && (
        <div className="space-y-6">
          {allAnnouncements.length > 0 ? allAnnouncements.map(announcement => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle>{announcement.title}</CardTitle>
                <CardDescription>
                  Posted by {announcement.author_name || announcement.posted_by?.name || 'System'} ({announcement.posted_by_role}) on {format(parseISO(announcement.date), 'PPpp')}
                  {announcement.target_class_id && announcement.target_class && (
                      <span className="text-xs block text-blue-500"> (Targeted to class: {announcement.target_class?.name} - {announcement.target_class?.division})</span>
                  )}
                  {!announcement.target_class_id && <span className="text-xs block text-gray-500"> (General Announcement)</span>}
                </CardDescription>
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

