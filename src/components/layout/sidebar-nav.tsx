
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
  UsersRound, // For Employee Registration
  DollarSign, // For Payroll
  Clock, // For Class Schedule
  CalendarRange, 
  BookOpenText,
  Briefcase, // For Manage Teachers (Admin) / My Classes (Teacher)
  UserPlus // For Register Student (Teacher)
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

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
  { href: '/admin/manage-teachers', label: 'Manage Teachers', icon: Briefcase }, // Changed icon
  { href: '/admin/employee-registration', label: 'Employee Registration', icon: UsersRound },
  { href: '/class-management', label: 'Class Management', icon: Presentation },
  { href: '/admin/admissions', label: 'View Admissions', icon: FilePlus2 }, 
  { href: '/admin/fee-categories', label: 'Fee Categories', icon: Tags },
  { href: '/admin/student-fees', label: 'Student Fees', icon: Receipt },
  { href: '/admin/academic-years', label: 'Academic Years', icon: CalendarRange },
  { href: '/admin/subjects', label: 'Subjects', icon: BookOpenText },
  { href: '/admin/exams', label: 'Exams', icon: FileText },
  { href: '/admin/student-scores', label: 'Student Scores', icon: Award },
  { href: '/admin/attendance', label: 'Attendance Records', icon: ClipboardCheck }, // Clarified label
  { href: '/admin/id-card-printing', label: 'ID Card Printing', icon: Printer },
  { href: '/admin/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/admin/class-schedule', label: 'Class Schedule', icon: Clock },
  { href: '/communication', label: 'Announcements', icon: Megaphone },
  { href: '/calendar-events', label: 'Calendar & Events', icon: CalendarDays },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/leave-application', label: 'Leave Management', icon: ClipboardEdit }, // Central leave processing
];

const teacherNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/profile', label: 'My Profile', icon: UserCircle },
  { href: '/teacher/my-classes', label: 'My Classes', icon: Briefcase }, // Changed icon
  { href: '/teacher/my-students', label: 'My Students', icon: Users },
  { href: '/teacher/register-student', label: 'Register Student', icon: UserPlus },
  { href: '/teacher/attendance', label: 'Class Attendance', icon: ClipboardCheck },
  { href: '/teacher/student-scores', label: 'Gradebook', icon: Award }, // Renamed from "Enter Scores"
  { href: '/teacher/assignments', label: 'Post Assignments', icon: ClipboardList }, // New
  { href: '/teacher/leave-requests', label: 'Student Leaves', icon: ClipboardEdit }, // New: For viewing student requests
  { href: '/teacher/id-card-printing', label: 'ID Card Printing', icon: Printer },
  { href: '/communication', label: 'Announcements', icon: Megaphone }, 
  { href: '/calendar-events', label: 'School Calendar', icon: CalendarDays },
  { href: '/teacher/reports', label: 'Reports', icon: BarChart3 },
];

const studentNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/my-profile', label: 'My Profile', icon: UserCircle },
  { href: '/student/subjects', label: 'My Subjects', icon: BookOpenText }, // Changed icon
  { href: '/student/assignments', label: 'My Assignments', icon: ClipboardList }, // Changed icon
  { href: '/student/study-material', label: 'Study Material', icon: BookMarked },
  { href: '/leave-application', label: 'Apply for Leave', icon: ClipboardEdit },
  { href: '/student/payment-history', label: 'Payment History', icon: CreditCard },
  { href: '/communication', label: 'View Announcements', icon: Megaphone },
  { href: '/calendar-events', label: 'School Calendar', icon: CalendarDays },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null); 

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      const validRoles: UserRole[] = ['superadmin', 'admin', 'teacher', 'student'];
      if (storedRole && validRoles.includes(storedRole)) {
        setCurrentUserRole(storedRole);
      } else {
        // Default to student or redirect to login if no role found, 
        // but for now, let's assume a role is always set post-login.
        // If this component renders before role is set, it might briefly show student nav.
        // A more robust solution might involve a global auth context.
        setCurrentUserRole(null); // Or redirect, or show loading
      }
    }
  }, []);

  if (currentUserRole === null) {
    // Can show a loading spinner or a minimal sidebar
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip={{ children: "Loading...", side: 'right', align: 'center' }}>
                    <LayoutDashboard />
                    <span>Loading...</span>
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
      navItems = []; // Or redirect to login
  }

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.label + item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href.length > 1 && pathname.split('/')[1] === item.href.split('/')[1] && pathname.split('/')[2] === item.href.split('/')[2] ) } // More specific active check
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
