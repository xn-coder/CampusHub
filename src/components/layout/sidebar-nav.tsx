
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
  UserPlus 
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
  { href: '/admin/manage-teachers', label: 'Manage Teachers', icon: UserCog },
  { href: '/admin/employee-registration', label: 'Employee Registration', icon: UsersRound },
  { href: '/class-management', label: 'Class Management', icon: Presentation },
  { href: '/admin/admissions', label: 'View Admissions', icon: FilePlus2 }, 
  { href: '/admin/fee-categories', label: 'Fee Categories', icon: Tags },
  { href: '/admin/student-fees', label: 'Student Fees', icon: Receipt },
  { href: '/admin/academics', label: 'Academics', icon: GraduationCap },
  { href: '/admin/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/admin/exams', label: 'Exams', icon: FileText },
  { href: '/admin/student-scores', label: 'Student Scores', icon: Award },
  { href: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
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
  { href: '/teacher/my-classes', label: 'My Classes', icon: Presentation },
  { href: '/teacher/my-students', label: 'My Students', icon: Users },
  { href: '/teacher/register-student', label: 'Register Student', icon: UserPlus },
  { href: '/teacher/attendance', label: 'Class Attendance', icon: ClipboardCheck },
  { href: '/teacher/student-scores', label: 'Enter Scores', icon: Award },
  { href: '/teacher/leave-requests', label: 'Leave Requests', icon: ClipboardEdit },
  { href: '/teacher/id-card-printing', label: 'ID Card Printing', icon: Printer },
  { href: '/communication', label: 'Announcements', icon: Megaphone }, 
  { href: '/calendar-events', label: 'School Calendar', icon: CalendarDays },
];

const studentNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/my-profile', label: 'My Profile', icon: UserCircle },
  { href: '/student/subjects', label: 'My Subjects', icon: BookOpen },
  { href: '/student/assignments', label: 'Assignments', icon: ClipboardList },
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
        // Default to student if role is invalid or not found, or handle error/redirect
        setCurrentUserRole('student'); 
      }
    }
  }, []);

  if (currentUserRole === null) {
    // Optionally, render a loading state or null
    return null; 
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
      navItems = studentNavItems; // Fallback, though should be handled by useEffect logic
  }

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.label + item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
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
