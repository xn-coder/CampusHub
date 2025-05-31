"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Announcement } from '@/types';
import { useState } from 'react';
import { PlusCircle, Send } from 'lucide-react';

const initialAnnouncements: Announcement[] = [
  { id: '1', title: 'School Reopens Monday', content: 'The school will reopen on Monday after the spring break. All students are expected to attend.', date: new Date(2024, 3, 10), author: 'Principal Office' },
  { id: '2', title: 'Science Fair Submissions', content: 'Reminder: The deadline for science fair project submissions is this Friday. Please submit your projects to Room 201.', date: new Date(2024, 3, 8), author: 'Science Department' },
];

export default function CommunicationPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [showForm, setShowForm] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAnnouncement(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAnnouncement.title && newAnnouncement.content) {
      const announcementToAdd: Announcement = {
        id: String(Date.now()),
        ...newAnnouncement,
        date: new Date(),
        author: 'Admin (You)' // Placeholder author
      };
      setAnnouncements(prev => [announcementToAdd, ...prev]);
      setNewAnnouncement({ title: '', content: '' });
      setShowForm(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Internal Communication" 
        description="Share important announcements and updates with the school community."
        actions={
          <Button onClick={() => setShowForm(prev => !prev)}>
            <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'New Announcement'}
          </Button>
        }
      />

      {showForm && (
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
        {announcements.length > 0 ? announcements.map(announcement => (
          <Card key={announcement.id}>
            <CardHeader>
              <CardTitle>{announcement.title}</CardTitle>
              <CardDescription>
                Posted by {announcement.author} on {announcement.date.toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{announcement.content}</p>
            </CardContent>
          </Card>
        )) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">No announcements yet. Be the first to post!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
