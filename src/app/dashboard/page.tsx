import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Megaphone, CalendarPlus, UserPlus, FileEdit } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const quickLinks = [
    { label: 'New Announcement', href: '/communication', icon: Megaphone },
    { label: 'Add Event', href: '/calendar-events', icon: CalendarPlus },
    { label: 'Manage Students', href: '/student-profile', icon: UserPlus },
    { label: 'Apply for Leave', href: '/leave-application', icon: FileEdit },
  ];

  const announcements = [
    { id: '1', title: 'Mid-term Exams Schedule', date: '2024-07-15', summary: 'The schedule for mid-term exams has been published. Please check the notice board.' },
    { id: '2', title: 'Annual Sports Day', date: '2024-07-10', summary: 'Get ready for the annual sports day on August 5th! Registrations open.' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Welcome back to CampusHub! Here's a quick overview." />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(link => (
          <Card key={link.href} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{link.label}</CardTitle>
              <link.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={link.href}>Go to {link.label.split(' ')[1]}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Stay updated with the latest news.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {announcements.map(announcement => (
                <li key={announcement.id} className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                  <h3 className="font-semibold">{announcement.title}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(announcement.date).toLocaleDateString()}</p>
                  <p className="text-sm mt-1">{announcement.summary}</p>
                </li>
              ))}
            </ul>
            <Button variant="link" asChild className="mt-4 px-0">
              <Link href="/communication">View all announcements</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Don't miss out on important school events.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Placeholder for upcoming events */}
            <p className="text-muted-foreground">No upcoming events. Check the calendar.</p>
             <Button variant="link" asChild className="mt-4 px-0">
              <Link href="/calendar-events">View Calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
