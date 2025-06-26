
"use client";

import type { NavItem, UserRole } from '@/types';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
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
  // BookMarked, // Icon for Study Material, removed
  Settings, 
  FilePlus2,
  Tags,
  Receipt,
  Printer,
  Clock, 
  CalendarRange, 
  BookOpenText,
  Briefcase, 
  UserPlus,
  History, 
  ScrollText,
  Library,
  KeyRound,
  BookOpenCheck
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton'; 
import { getStudentPendingFeeCountAction } from '@/app/(app)/admin/student-fees/actions';
import { supabase } from '@/lib/supabaseClient';


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
  { href: '/teacher/student-scores', label: 'Gradebook (Exams)', icon: Award }, 
  { href: '/teacher/post-assignments', label: 'Post Assignments', icon: ClipboardList }, 
  { href: '/teacher/grade-assignments', label: 'Grade Assignments', icon: BookOpenCheck },
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
  // { href: '/student/study-material', label: 'Study Material', icon: BookMarked }, // Removed
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
  const [isMounted, setIsMounted] = useState(false); 
  const [pendingFeeCount, setPendingFeeCount] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true); 
    const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
    const validRoles: UserRole[] = ['superadmin', 'admin', 'teacher', 'student'];
    if (storedRole && validRoles.includes(storedRole)) {
      setCurrentUserRole(storedRole);
    } else {
      setCurrentUserRole(null); 
    }
  }, []);

  useEffect(() => {
    async function fetchFeeCount() {
        if (currentUserRole === 'student') {
            const userId = localStorage.getItem('currentUserId');
            if (userId) {
                const { data: studentProfile, error } = await supabase
                    .from('students')
                    .select('id, school_id')
                    .eq('user_id', userId)
                    .single();
                
                if (studentProfile && studentProfile.school_id) {
                    const feeResult = await getStudentPendingFeeCountAction(studentProfile.id, studentProfile.school_id);
                    if (feeResult.ok) {
                        setPendingFeeCount(feeResult.count);
                    }
                }
            }
        }
    }
    fetchFeeCount();
  }, [currentUserRole]);


  if (!isMounted) {
    return (
      <SidebarMenu>
        {[...Array(5)].map((_, i) => ( 
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
      {
        const paymentHistoryItem = studentNavItems.find(item => item.href === '/student/payment-history');
        if (paymentHistoryItem && pendingFeeCount !== null && pendingFeeCount > 0) {
            paymentHistoryItem.badge = pendingFeeCount;
        } else if (paymentHistoryItem) {
            delete paymentHistoryItem.badge; 
        }
        navItems = studentNavItems;
      }
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
          {item.badge && item.badge > 0 && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
