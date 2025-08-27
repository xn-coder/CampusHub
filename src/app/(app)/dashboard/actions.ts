
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole, AnnouncementDB, CalendarEventDB, Student, Teacher, SchoolEntry as School, ClassData, Assignment, LeaveRequestStatus, Expense } from '@/types';
import { subDays, startOfDay, endOfDay, addDays, formatISO } from 'date-fns';
import { checkStudentFeeStatusAction } from '@/app/(app)/admin/student-fees/actions';
import { getAnnouncementsAction } from '@/app/(app)/communication/actions';


interface DashboardData {
  // Student specific
  upcomingAssignmentsCount?: number;
  feeStatus?: { isDefaulter: boolean; message: string };
  // Teacher specific
  assignedClassesCount?: number;
  totalStudentsInClasses?: number;
  pendingLeaveRequestsCount?: number;
  // Admin specific
  totalSchoolStudents?: number;
  totalSchoolTeachers?: number;
  totalSchoolClasses?: number;
  pendingAdmissionsCount?: number;
  pendingFeesCount?: number;
  totalExpenses?: number;
  // Superadmin specific
  totalSchools?: number;
  totalUsers?: number;
  // Common
  recentAnnouncements?: Pick<AnnouncementDB, 'id' | 'title' | 'date' | 'author_name' | 'posted_by_role' | 'target_class'>[];
  upcomingEvents?: Pick<CalendarEventDB, 'id' | 'title' | 'date' | 'start_time' | 'is_all_day'>[];
  // Counts for sidebar
  sidebarCounts?: {
      pendingLeaveRequests?: number;
      pendingTCRequests?: number;
      pendingAssignments?: number;
      pendingFeePayments?: number;
  }
}


export async function getDashboardDataAction(userId: string, userRole: UserRole): Promise<{ ok: boolean; data?: DashboardData; message?: string }> {
  // MOCK IMPLEMENTATION
  await new Promise(res => setTimeout(res, 500));
  const dashboardData: DashboardData = { sidebarCounts: {} };

  const recentAnnouncements: DashboardData['recentAnnouncements'] = [
      { id: '1', title: 'Welcome to the New School Year!', date: new Date().toISOString(), author_name: 'Principal', posted_by_role: 'admin' },
      { id: '2', title: 'Science Fair Submissions Due', date: subDays(new Date(), 2).toISOString(), author_name: 'Mr. Faraday', posted_by_role: 'teacher' },
  ];
  const upcomingEvents: DashboardData['upcomingEvents'] = [
      { id: '1', title: 'Parent-Teacher Meeting', date: formatISO(addDays(new Date(), 3), { representation: 'date' }), is_all_day: true },
      { id: '2', title: 'Mid-Term Exams Start', date: formatISO(addDays(new Date(), 7), { representation: 'date' }), is_all_day: true },
  ];

  dashboardData.recentAnnouncements = recentAnnouncements;
  dashboardData.upcomingEvents = upcomingEvents;

  switch(userRole) {
      case 'student':
          dashboardData.upcomingAssignmentsCount = 5;
          dashboardData.feeStatus = { isDefaulter: false, message: 'All fees are paid.' };
          dashboardData.sidebarCounts!.pendingAssignments = 5;
          dashboardData.sidebarCounts!.pendingFeePayments = 0;
          break;
      case 'teacher':
          dashboardData.assignedClassesCount = 3;
          dashboardData.totalStudentsInClasses = 75;
          dashboardData.pendingLeaveRequestsCount = 2;
          break;
      case 'admin':
          dashboardData.totalSchoolStudents = 350;
          dashboardData.totalSchoolTeachers = 25;
          dashboardData.totalSchoolClasses = 12;
          dashboardData.pendingFeesCount = 15;
          dashboardData.totalExpenses = 450000;
          dashboardData.sidebarCounts!.pendingLeaveRequests = 4;
          dashboardData.sidebarCounts!.pendingTCRequests = 1;
          break;
      case 'superadmin':
          dashboardData.totalSchools = 10;
          dashboardData.totalUsers = 4250;
          break;
  }

  return { ok: true, data: dashboardData };
}

