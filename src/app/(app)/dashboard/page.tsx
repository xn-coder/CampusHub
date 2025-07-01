
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Megaphone, CalendarPlus, UserPlus, FileEdit, Users, Briefcase, Award, FileText as FileTextIcon,
    ClipboardList, Building, Settings, School, UserCog, Library, Receipt, Tags, BarChart3, Clock,
    ClipboardCheck, CalendarDays, BookOpenText, KeyRound, CreditCard, BookMarked, Loader2, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { UserRole, NavItem } from '@/types';
import { getDashboardDataAction } from './actions';
import { format, parseISO, isValid } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface DashboardStats {
  upcomingAssignmentsCount?: number;
  feeStatus?: { isDefaulter: boolean; message: string };
  assignedClassesCount?: number;
  totalStudentsInClasses?: number;
  pendingLeaveRequestsCount?: number;
  totalSchoolStudents?: number;
  totalSchoolTeachers?: number;
  totalSchoolClasses?: number;
  pendingAdmissionsCount?: number;
  pendingFeesCount?: number;
  totalSchools?: number;
  totalUsers?: number;
  recentAnnouncements?: { id: string; title: string; date: string, author_name?: string | null, posted_by_role?: UserRole | null, target_class?: {name: string, division: string} | null }[];
  upcomingEvents?: { id: string; title: string; date: string, start_time?: string | null, is_all_day: boolean }[];
}

const getDashboardTitle = (role: UserRole | null): string => {
  switch (role) {
    case 'superadmin':
      return 'Super Admin Dashboard';
    case 'admin':
      return 'Admin Dashboard';
    case 'teacher':
      return 'Teacher Dashboard';
    case 'student':
      return 'Student Dashboard';
    default:
      return 'Dashboard';
  }
};


export default function DashboardPage() {
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('currentUserRole') as UserRole | null;
    const userId = localStorage.getItem('currentUserId');
    const userName = localStorage.getItem('currentUserName');
    
    setCurrentUserRole(role);
    setCurrentUserName(userName);

    async function loadData() {
      if (userId && role) {
        setIsLoading(true);
        const result = await getDashboardDataAction(userId, role);

        if (result.ok && result.data) {
          setDashboardData(result.data);
        } else {
          toast({ title: "Error loading dashboard", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
      } else {
        setIsLoading(false); // No user, no loading
      }
    }
    
    loadData();
  }, [toast]);

  const getQuickLinks = (): NavItem[] => {
    switch (currentUserRole) {
      case 'student':
        return [
          { label: 'My Assignments', href: '/student/assignments', icon: ClipboardList },
          { label: 'My Scores', href: '/student/my-scores', icon: Award },
          { label: 'LMS Courses', href: '/lms/available-courses', icon: Library },
          { label: 'Apply for Leave', href: '/leave-application', icon: FileEdit },
        ];
      case 'teacher':
        return [
          { label: 'Post Assignments', href: '/teacher/post-assignments', icon: ClipboardList },
          { label: 'Gradebook', href: '/teacher/student-scores', icon: Award },
          { label: 'My Classes', href: '/teacher/my-classes', icon: Briefcase },
          { label: 'Student Leaves', href: '/teacher/leave-requests', icon: FileEdit },
        ];
      case 'admin':
        return [
          { label: 'Manage Students', href: '/admin/manage-students', icon: Users },
          { label: 'Manage Teachers', href: '/admin/manage-teachers', icon: Briefcase }, 
          { label: 'Class Management', href: '/class-management', icon: School },
          { label: 'Student Fees', href: '/admin/student-fees', icon: Receipt },
        ];
      case 'superadmin':
        return [
          { label: 'Create School', href: '/superadmin/create-school', icon: Building },
          { label: 'Manage Schools', href: '/superadmin/manage-school', icon: Settings },
          { label: 'Global Announcements', href: '/communication', icon: Megaphone }, 
        ];
      default:
        return [];
    }
  };

  const quickLinks = getQuickLinks();
  
  const formatDateSafe = (dateString?: string | null, includeTime = false) => {
    if (!dateString) return 'N/A';
    const dateObj = parseISO(dateString);
    if (!isValid(dateObj)) return 'Invalid Date';
    return format(dateObj, includeTime ? 'PPpp' : 'PP');
  };

  const renderStatsCards = () => {
    if (!dashboardData) return null;
    switch (currentUserRole) {
      case 'student':
        return (
          <>
            <StatsCard title="Upcoming Assignments" value={dashboardData.upcomingAssignmentsCount ?? 0} icon={ClipboardList} />
          </>
        );
      case 'teacher':
        return (
          <>
            <StatsCard title="Classes Assigned" value={dashboardData.assignedClassesCount ?? 0} icon={Briefcase} />
            <StatsCard title="Total Students" value={dashboardData.totalStudentsInClasses ?? 0} icon={Users} />
            <StatsCard title="Pending Leave Requests" value={dashboardData.pendingLeaveRequestsCount ?? 0} icon={FileEdit} />
          </>
        );
      case 'admin':
        return (
          <>
            <StatsCard title="Total Students" value={dashboardData.totalSchoolStudents ?? 0} icon={Users} />
            <StatsCard title="Total Teachers" value={dashboardData.totalSchoolTeachers ?? 0} icon={Briefcase} />
            <StatsCard title="Active Classes" value={dashboardData.totalSchoolClasses ?? 0} icon={School} />
            <StatsCard title="Pending Fees" value={dashboardData.pendingFeesCount ?? 0} icon={Receipt} />
          </>
        );
      case 'superadmin':
        return (
          <>
            <StatsCard title="Total Schools" value={dashboardData.totalSchools ?? 0} icon={Building} />
            <StatsCard title="Total Users" value={dashboardData.totalUsers ?? 0} icon={Users} />
          </>
        );
      default:
        return null;
    }
  };
  
  const StatsCard = ({ title, value, icon: Icon }: { title: string; value: number | string; icon: React.ElementType }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );


  if (isLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Dashboard" />
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> <span>Loading dashboard data...</span>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title={getDashboardTitle(currentUserRole)}
        description={`Welcome back, ${currentUserName || 'User'}! Here's your overview.`} 
      />
      
      {currentUserRole === 'student' && dashboardData?.feeStatus?.isDefaulter && (
          <Alert variant="destructive" className="border-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Action Required: Overdue Fees</AlertTitle>
              <AlertDescription>
                  {dashboardData.feeStatus.message} Access to some features may be restricted.
                  <Button asChild variant="link" className="p-0 pl-1 h-auto text-destructive-foreground font-bold">
                    <Link href="/student/payment-history">Go to Payments</Link>
                  </Button>
              </AlertDescription>
          </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderStatsCards()}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access common tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickLinks.map(link => (
              <Button key={link.href} asChild variant="outline" className="justify-start text-left h-auto py-3">
                <Link href={link.href}>
                  <link.icon className="mr-3 h-5 w-5 shrink-0" />
                  <span className="flex-1">{link.label}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
            <CardDescription>Stay updated with the latest news.</CardDescription>
          </CardHeader>
          <CardContent>
            {(dashboardData?.recentAnnouncements?.length ?? 0) > 0 ? (
              <ul className="space-y-3 max-h-72 overflow-y-auto">
                {dashboardData!.recentAnnouncements!.map(announcement => (
                  <li key={announcement.id} className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                    <Link href="/communication">
                        <h3 className="font-semibold hover:underline">{announcement.title}</h3>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                        {formatDateSafe(announcement.date)} by {announcement.author_name || announcement.posted_by_role}
                        {announcement.target_class && <span className="text-blue-500"> (For {announcement.target_class.name} - {announcement.target_class.division})</span>}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No recent announcements.</p>
            )}
            <Button variant="link" asChild className="mt-3 px-0">
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
            {(dashboardData?.upcomingEvents?.length ?? 0) > 0 ? (
               <ul className="space-y-3 max-h-72 overflow-y-auto">
                {dashboardData!.upcomingEvents!.map(event => (
                  <li key={event.id} className="p-3 rounded-md border hover:bg-accent/50 transition-colors">
                    <Link href="/calendar-events">
                        <h3 className="font-semibold hover:underline">{event.title}</h3>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                        {formatDateSafe(event.date)}
                        {!event.is_all_day && event.start_time && ` at ${event.start_time}`}
                        {event.is_all_day && ` (All Day)`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
                <p className="text-muted-foreground text-center py-4">No upcoming events in the next 7 days.</p>
            )}
             <Button variant="link" asChild className="mt-3 px-0">
              <Link href="/calendar-events">View Calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
