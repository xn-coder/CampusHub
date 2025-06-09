
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Announcement, UserRole, ClassData, Student } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Send } from 'lucide-react';

const MOCK_ANNOUNCEMENTS_KEY = 'mockAnnouncementsData'; // To store announcements
const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';


const initialAnnouncements: Announcement[] = [
  { id: 'sa1', title: 'Platform Maintenance Alert', content: 'Scheduled maintenance on Sunday. System may be unavailable from 2 AM to 4 AM.', date: new Date(2024, 6, 25), authorName: 'System Operations', postedByRole: 'superadmin' },
  { id: 'adm1', title: 'School Reopens Monday', content: 'The school will reopen on Monday after the spring break. All students are expected to attend.', date: new Date(2024, 3, 10), authorName: 'Principal Office', postedByRole: 'admin' },
  { id: 'teach1', title: 'Science Fair Submissions', content: 'Reminder: The deadline for science fair project submissions is this Friday. Please submit your projects to Room 201.', date: new Date(2024, 3, 8), authorName: 'Science Department', postedByRole: 'teacher' },
  { id: 'teach2', title: 'Math Test - Grade 10A', content: 'Your Math test previously scheduled for Wednesday will now be on Thursday.', date: new Date(2024, 6, 20), authorName: 'Mr. Matherton', postedByRole: 'teacher', targetClassSectionId: 'ac-some-grade10a-id' /* Replace with actual ID if testing */ },
];


export default function CommunicationPage() {
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', authorName: '', targetClassSectionId: '' });
  const [showForm, setShowForm] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | Student | null>(null); // For student's classId

  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<ClassData[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => { // Load initial announcements and user data
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      const storedUserId = localStorage.getItem('currentUserId');
      setCurrentUserRole(storedRole);
      setCurrentUserId(storedUserId);

      const storedAnnouncements = localStorage.getItem(MOCK_ANNOUNCEMENTS_KEY);
      setAllAnnouncements(storedAnnouncements ? JSON.parse(storedAnnouncements) : initialAnnouncements);
      
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
            const studentData = allStudents.find(s => s.id === storedUserId);
            if(studentData) setCurrentUserData(studentData);
        }
      }
    }
  }, []);

  useEffect(() => { // Filter announcements when role or data changes
    if (!currentUserRole) {
      setFilteredAnnouncements([]);
      return;
    }

    let studentClassId: string | undefined = undefined;
    if (currentUserRole === 'student' && currentUserData) {
        studentClassId = (currentUserData as Student).classId;
    }

    const newFiltered = allAnnouncements.filter(ann => {
      switch (currentUserRole) {
        case 'superadmin': // Sees all
          return true;
        case 'admin': // Sees admin and superadmin
          return ann.postedByRole === 'superadmin' || ann.postedByRole === 'admin' || ann.postedByRole === 'teacher';
        case 'teacher': // Sees teacher, admin, superadmin
           return ann.postedByRole === 'teacher' || ann.postedByRole === 'admin' || ann.postedByRole === 'superadmin';
        case 'student': // Sees relevant teacher posts and admin posts
          if (ann.postedByRole === 'teacher') {
            return !ann.targetClassSectionId || ann.targetClassSectionId === studentClassId;
          }
          return ann.postedByRole === 'admin'; // Students also see general admin posts
        default:
          return false;
      }
    });
    setFilteredAnnouncements(newFiltered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

  }, [allAnnouncements, currentUserRole, currentUserData]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleTargetClassChange = (value: string) => {
    setNewAnnouncement(prev => ({ ...prev, targetClassSectionId: value === "general" ? "" : value }));
  };

  const handleSubmitAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAnnouncement.title && newAnnouncement.content && newAnnouncement.authorName && currentUserRole) {
      const announcementToAdd: Announcement = {
        id: String(Date.now()),
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        authorName: newAnnouncement.authorName,
        postedByRole: currentUserRole,
        date: new Date(),
        targetClassSectionId: newAnnouncement.targetClassSectionId || undefined,
      };
      const updatedAnnouncements = [announcementToAdd, ...allAnnouncements];
      setAllAnnouncements(updatedAnnouncements);
      localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      
      setNewAnnouncement({ title: '', content: '', authorName: '', targetClassSectionId: '' });
      setShowForm(false);
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
            <Button onClick={() => setShowForm(prev => !prev)}>
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
                      <SelectItem value="general">General (All Students)</SelectItem>
                      {teacherAssignedClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea id="content" name="content" value={newAnnouncement.content} onChange={handleInputChange} placeholder="Write your announcement here..." required rows={5} />
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
                {announcement.targetClassSectionId && teacherAssignedClasses.find(c=> c.id === announcement.targetClassSectionId) && (
                    <span className="text-xs block text-blue-500"> (Targeted: {teacherAssignedClasses.find(c=>c.id === announcement.targetClassSectionId)?.name} - {teacherAssignedClasses.find(c=>c.id === announcement.targetClassSectionId)?.division})</span>
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
