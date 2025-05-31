
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Announcement, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { PlusCircle, Send } from 'lucide-react';

const initialAnnouncements: Announcement[] = [
  { id: '1', title: 'School Reopens Monday', content: 'The school will reopen on Monday after the spring break. All students are expected to attend.', date: new Date(2024, 3, 10), authorName: 'Principal Office', postedByRole: 'admin' },
  { id: '2', title: 'Science Fair Submissions', content: 'Reminder: The deadline for science fair project submissions is this Friday. Please submit your projects to Room 201.', date: new Date(2024, 3, 8), authorName: 'Science Department', postedByRole: 'teacher' },
  { id: 'sa1', title: 'Important Update for Admins', content: 'All admins please attend the meeting on Friday.', date: new Date(2024, 6, 1), authorName: 'Super Admin', postedByRole: 'superadmin' },
];

export default function CommunicationPage() {
  const [allAnnouncements, setAllAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', authorName: '' });
  const [showForm, setShowForm] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      setCurrentUserRole(storedRole);
    }
  }, []);

  useEffect(() => {
    if (!currentUserRole) {
      setFilteredAnnouncements([]);
      return;
    }

    const newFilteredAnnouncements = allAnnouncements.filter(announcement => {
      if (currentUserRole === 'superadmin') {
        return announcement.postedByRole === 'superadmin'; // Superadmins see their own relevant posts
      }
      if (currentUserRole === 'admin') {
        return announcement.postedByRole === 'superadmin' || announcement.postedByRole === 'admin';
      }
      if (currentUserRole === 'teacher') {
        return announcement.postedByRole === 'admin' || announcement.postedByRole === 'teacher';
      }
      if (currentUserRole === 'student') {
        return announcement.postedByRole === 'teacher';
      }
      return false;
    });
    setFilteredAnnouncements(newFilteredAnnouncements.sort((a,b) => b.date.getTime() - a.date.getTime()));
  }, [allAnnouncements, currentUserRole]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
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
      };
      setAllAnnouncements(prev => [announcementToAdd, ...prev]);
      setNewAnnouncement({ title: '', content: '', authorName: '' });
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
                Posted by {announcement.authorName} ({announcement.postedByRole}) on {announcement.date.toLocaleDateString()}
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
