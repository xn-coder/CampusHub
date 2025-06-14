
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Announcement, UserRole, ClassData, Student, User } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Send } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_ANNOUNCEMENTS_KEY = 'mockAnnouncementsData';
const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase'; // To get current user's name if needed

const initialAnnouncements: Announcement[] = [
  { id: 'sa1', title: 'Platform Maintenance Alert', content: 'Scheduled maintenance on Sunday. System may be unavailable from 2 AM to 4 AM.', date: new Date(2024, 6, 25), authorName: 'System Operations', postedByRole: 'superadmin' },
  { id: 'adm1', title: 'School Reopens Monday', content: 'The school will reopen on Monday after the spring break. All students are expected to attend.', date: new Date(2024, 3, 10), authorName: 'Principal Office', postedByRole: 'admin' },
  { id: 'teach1', title: 'Science Fair Submissions', content: 'Reminder: The deadline for science fair project submissions is this Friday. Please submit your projects to Room 201.', date: new Date(2024, 3, 8), authorName: 'Science Department', postedByRole: 'teacher' },
];

export default function CommunicationPage() {
  const { toast } = useToast();
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', authorName: '', targetClassSectionId: '' });
  const [notifyViaEmailMock, setNotifyViaEmailMock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<User | null>(null);
  const [studentData, setStudentData] = useState<Student | null>(null);

  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<ClassData[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => { 
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      const storedUserId = localStorage.getItem('currentUserId');
      setCurrentUserRole(storedRole);
      setCurrentUserId(storedUserId);

      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      if(storedUsers && storedUserId) {
        const users: User[] = JSON.parse(storedUsers);
        const CUser = users.find(u => u.id === storedUserId);
        if(CUser) setCurrentUserInfo(CUser);
      }
      
      const storedAnnouncementsData = localStorage.getItem(MOCK_ANNOUNCEMENTS_KEY);
      setAllAnnouncements(storedAnnouncementsData ? JSON.parse(storedAnnouncementsData).map((a: any) => ({...a, date: new Date(a.date)})) : initialAnnouncements.map(a => ({...a, date: new Date(a.date)})));
      
      if (storedRole === 'teacher' && storedUserId) {
        const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
        if (storedActiveClasses) {
          const allClasses: ClassData[] = JSON.parse(storedActiveClasses);
          setTeacherAssignedClasses(allClasses.filter(cls => cls.teacherId === storedUserId));
        }
      }
      if (storedRole === 'student' && storedUserId) {
        const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
        if(storedStudents){
            const allStudents: Student[] = JSON.parse(storedStudents);
            const SData = allStudents.find(s => s.id === storedUserId);
            if(SData) setStudentData(SData);
        }
      }
    }
  }, []);

  useEffect(() => { 
    if (!currentUserRole) {
      setFilteredAnnouncements([]);
      return;
    }

    let studentClassId: string | undefined = undefined;
    if (currentUserRole === 'student' && studentData) {
        studentClassId = studentData.classId;
    }

    const newFiltered = allAnnouncements.filter(ann => {
      if (currentUserRole === 'superadmin') return true;
      if (currentUserRole === 'admin') return ann.postedByRole === 'superadmin' || ann.postedByRole === 'admin' || ann.postedByRole === 'teacher';
      if (currentUserRole === 'teacher') return ann.postedByRole !== 'student'; // Teachers see all non-student posts
      if (currentUserRole === 'student') {
        if (ann.postedByRole === 'teacher') { // Student sees teacher post if general or targeted to their class
          return !ann.targetClassSectionId || ann.targetClassSectionId === studentClassId;
        }
        return ann.postedByRole === 'admin' || ann.postedByRole === 'superadmin'; // Students also see general admin/superadmin posts
      }
      return false;
    });
    setFilteredAnnouncements(newFiltered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

  }, [allAnnouncements, currentUserRole, studentData]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleTargetClassChange = (value: string) => {
    setNewAnnouncement(prev => ({ ...prev, targetClassSectionId: value === "general" ? "" : value }));
  };

  const handleSubmitAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    const authorNameToUse = newAnnouncement.authorName.trim() || currentUserInfo?.name || 'CampusHub User';

    if (newAnnouncement.title.trim() && newAnnouncement.content.trim() && currentUserRole) {
      const announcementToAdd: Announcement = {
        id: String(Date.now()),
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        authorName: authorNameToUse,
        postedByRole: currentUserRole,
        date: new Date(),
        targetClassSectionId: newAnnouncement.targetClassSectionId || undefined,
      };
      const updatedAnnouncements = [announcementToAdd, ...allAnnouncements];
      setAllAnnouncements(updatedAnnouncements);
      localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      
      let toastDescription = `${newAnnouncement.title} has been posted.`;
      if (notifyViaEmailMock) {
        toastDescription += " (Email notification simulated)";
      }
      toast({ title: "Announcement Posted", description: toastDescription });

      setNewAnnouncement({ title: '', content: '', authorName: '', targetClassSectionId: '' });
      setNotifyViaEmailMock(false);
      setShowForm(false);
    } else {
      toast({title: "Error", description: "Title and Content are required.", variant: "destructive"});
    }
  };

  const canPostAnnouncement = currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'teacher';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Announcements" 
        description="Share and view important updates."
        actions={
          canPostAnnouncement ? (
            <Button onClick={() => {
              setShowForm(prev => !prev);
              if(currentUserInfo && newAnnouncement.authorName === '') {
                 setNewAnnouncement(prev => ({...prev, authorName: currentUserInfo.name}));
              }
            }}>
              <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'New Announcement'}
            </Button>
          ) : null
        }
      />

      {showForm && canPostAnnouncement && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Announcement</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmitAnnouncement}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" value={newAnnouncement.title} onChange={handleInputChange} placeholder="Announcement Title" required />
              </div>
               <div>
                <Label htmlFor="authorName">Author Name / Department</Label>
                <Input id="authorName" name="authorName" value={newAnnouncement.authorName} onChange={handleInputChange} placeholder="e.g., Principal's Office, Your Name" required />
              </div>
              {currentUserRole === 'teacher' && teacherAssignedClasses.length > 0 && (
                <div>
                  <Label htmlFor="targetClassSectionId">Target Audience (Optional)</Label>
                  <Select value={newAnnouncement.targetClassSectionId} onValueChange={handleTargetClassChange}>
                    <SelectTrigger id="targetClassSectionId">
                      <SelectValue placeholder="Select target class (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (All My Students)</SelectItem>
                      {teacherAssignedClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">If not specified, announcement is visible more broadly based on your role.</p>
                </div>
              )}
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea id="content" name="content" value={newAnnouncement.content} onChange={handleInputChange} placeholder="Write your announcement here..." required rows={5} />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notifyViaEmailMock" 
                  checked={notifyViaEmailMock} 
                  onCheckedChange={(checked) => setNotifyViaEmailMock(!!checked)}
                />
                <Label htmlFor="notifyViaEmailMock">Notify via Email (Simulation)</Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit"><Send className="mr-2 h-4 w-4" /> Post Announcement</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div className="space-y-6">
        {filteredAnnouncements.length > 0 ? filteredAnnouncements.map(announcement => (
          <Card key={announcement.id}>
            <CardHeader>
              <CardTitle>{announcement.title}</CardTitle>
              <CardDescription>
                Posted by {announcement.authorName} ({announcement.postedByRole}) on {new Date(announcement.date).toLocaleDateString()}
                {announcement.targetClassSectionId && (
                    <span className="text-xs block text-blue-500"> (Targeted)</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{announcement.content}</p>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">No announcements relevant to your role at this time.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
