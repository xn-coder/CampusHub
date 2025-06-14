
"use client";

import type { NavItem, UserRole } from '@/types';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  School,
  ClipboardEdit,
  Users,
  Presentation,
  Megaphone,
  CalendarDays,
  Building, 
  UserCog,
  GraduationCap,
  BookOpen,
  FileText,
  Award,
  ClipboardCheck,
  BarChart3,
  UserCircle,
  CreditCard,
  ClipboardList, 
  BookMarked,
  Settings, 
  FilePlus2,
  Tags,
  Receipt,
  Printer,
  UsersRound, 
  DollarSign, 
  Clock, 
  CalendarRange, 
  BookOpenText,
  Briefcase, 
  UserPlus,
  History, 
  ScrollText,
  Library,
  KeyRound
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

const superAdminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/superadmin/create-school', label: 'Create School', icon: Building },
  { href: '/superadmin/manage-school', label: 'Manage Schools', icon: Settings },
  { href: '/communication', label: 'Announcements', icon: Megaphone }, 
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/school-details', label: 'School Details', icon: School },
  { href: '/admin/manage-students', label: 'Manage Students', icon: Users },
  { href: '/admin/manage-teachers', label: 'Manage Teachers', icon: Briefcase }, 
  { href: '/admin/employee-registration', label: 'Employee Registration', icon: UsersRound },
  { href: '/class-management', label: 'Class Management', icon: Presentation },
  { href: '/admin/lms/courses', label: 'LMS Courses', icon: Library }, 
  { href: '/admin/admissions', label: 'View Admissions', icon: FilePlus2 }, 
  { href: '/admin/fee-categories', label: 'Fee Categories', icon: Tags },
  { href: '/admin/student-fees', label: 'Student Fees', icon: Receipt },
  { href: '/admin/academic-years', label: 'Academic Years', icon: CalendarRange },
  { href: '/admin/subjects', label: 'Subjects', icon: BookOpenText },
  { href: '/admin/exams', label: 'Exams', icon: FileText },
  { href: '/admin/student-scores', label: 'Student Scores', icon: Award },
  { href: '/admin/attendance', label: 'Attendance Records', icon: ClipboardCheck }, 
  { href: '/admin/id-card-printing', label: 'ID Card Printing', icon: Printer },
  { href: '/admin/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/admin/class-schedule', label: 'Class Schedule', icon: Clock },
  { href: '/communication', label: 'Announcements', icon: Megaphone },
  { href: '/calendar-events', label: 'Calendar & Events', icon: CalendarDays },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/leave-application', label: 'Leave Management', icon: ClipboardEdit }, 
];

const teacherNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/profile', label: 'My Profile', icon: UserCircle },
  { href: '/teacher/my-classes', label: 'My Classes', icon: Briefcase }, 
  { href: '/teacher/my-students', label: 'My Students', icon: Users },
  { href: '/teacher/register-student', label: 'Register Student', icon: UserPlus },
  { href: '/teacher/attendance', label: 'Class Attendance', icon: ClipboardCheck },
  { href: '/teacher/student-scores', label: 'Gradebook', icon: Award }, 
  { href: '/teacher/post-assignments', label: 'Post Assignments', icon: ClipboardList }, 
  { href: '/teacher/assignment-history', label: 'Assignment History', icon: ScrollText },
  { href: '/teacher/leave-requests', label: 'Student Leaves', icon: ClipboardEdit }, 
  { href: '/teacher/id-card-printing', label: 'ID Card Printing', icon: Printer },
  { href: '/lms/available-courses', label: 'LMS Courses', icon: Library }, 
  { href: '/communication', label: 'Announcements', icon: Megaphone }, 
  { href: '/calendar-events', label: 'School Calendar', icon: CalendarDays },
  { href: '/teacher/reports', label: 'Reports', icon: BarChart3 },
];

const studentNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/my-profile', label: 'My Profile', icon: UserCircle },
  { href: '/student/subjects', label: 'My Subjects', icon: BookOpenText }, 
  { href: '/student/assignments', label: 'My Assignments', icon: ClipboardList }, 
  { href: '/student/my-scores', label: 'My Scores', icon: Award },
  { href: '/student/study-material', label: 'Study Material', icon: BookMarked },
  { href: '/lms/available-courses', label: 'LMS Courses', icon: Library },
  { href: '/student/lms/activate', label: 'Activate Course', icon: KeyRound },
  { href: '/leave-application', label: 'Apply for Leave', icon: ClipboardEdit },
  { href: '/student/payment-history', label: 'Payment History', icon: CreditCard },
  { href: '/communication', label: 'View Announcements', icon: Megaphone },
  { href: '/calendar-events', label: 'School Calendar', icon: CalendarDays },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null); 
  const [isMounted, setIsMounted] = useState(false); // To track client-side mount

  useEffect(() => {
    setIsMounted(true); // Component has mounted on the client
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      const validRoles: UserRole[] = ['superadmin', 'admin', 'teacher', 'student'];
      if (storedRole && validRoles.includes(storedRole)) {
        setCurrentUserRole(storedRole);
      } else {
        setCurrentUserRole(null); 
      }
    }
  }, []);

  if (!isMounted) {
    // Render a skeleton or minimal loading state that matches server render
    // This ensures the initial client render is consistent with SSR.
    return (
      <SidebarMenu>
        {[...Array(5)].map((_, i) => ( // Render 5 skeleton items as an example
          <SidebarMenuItem key={i}>
            <SidebarMenuButton
              asChild
              tooltip={{ children: "Loading...", side: 'right', align: 'center' }}
            >
              <a>
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="ml-2 h-4 w-20 rounded group-data-[collapsible=icon]:hidden" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }
  
  if (currentUserRole === null) {
     // After mounting, if role is still null (e.g., no role in localStorage), render a specific "no role" state or minimal nav
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip={{ children: "Loading...", side: 'right', align: 'center' }}>
                    <LayoutDashboard />
                    <span>Loading Role...</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
  }


  let navItems: NavItem[];

  switch (currentUserRole) {
    case 'superadmin':
      navItems = superAdminNavItems;
      break;
    case 'admin':
      navItems = adminNavItems;
      break;
    case 'teacher':
      navItems = teacherNavItems;
      break;
    case 'student':
      navItems = studentNavItems;
      break;
    default:
      navItems = []; 
  }

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.label + item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href.length > 1 && pathname.split('/')[1] === item.href.split('/')[1] && pathname.split('/')[2] === item.href.split('/')[2] ) } 
              tooltip={{ children: item.label, side: 'right', align: 'center' }}
            >
              <a>
                <item.icon />
                <span>{item.label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

