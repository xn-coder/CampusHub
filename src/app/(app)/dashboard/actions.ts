
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole, AnnouncementDB, CalendarEventDB, Student, Teacher, SchoolEntry as School, ClassData, Assignment, LeaveRequestStatus, Expense } from '@/types';
import { subDays, startOfDay, endOfDay, addDays, formatISO } from 'date-fns';
import { getAnnouncementsAction } from '@/app/(app)/communication/actions';


interface DashboardData {
  // Student specific
  upcomingAssignmentsCount?: number;
  feeStatus?: { isDefaulter: boolean; message: string };
  // Teacher specific
  assignedClassesCount?: number;
  totalStudentsInClasses?: number;
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
  const supabase = createSupabaseServerClient();
  const dashboardData: DashboardData = { sidebarCounts: {} };
  
  // --- Common Data: Announcements & Events ---
  const { data: userRecord, error: userError } = await supabase.from('users').select('school_id').eq('id', userId).single();
  const schoolId = userRecord?.school_id;

  if (schoolId) {
      const announcementsResult = await getAnnouncementsAction({ school_id: schoolId, user_role: userRole, user_id: userId, student_user_id: userRole === 'student' ? userId : undefined });
      if (announcementsResult.ok) {
          dashboardData.recentAnnouncements = announcementsResult.announcements?.slice(0, 5);
      }
      
      const { data: events, error: eventsError } = await supabase
          .from('calendar_events')
          .select('id, title, date, start_time, is_all_day')
          .eq('school_id', schoolId)
          .gte('date', formatISO(startOfDay(new Date()), { representation: 'date' }))
          .limit(5)
          .order('date', { ascending: true });
      if (!eventsError) {
          dashboardData.upcomingEvents = events;
      }
  }


  // --- Role-Specific Data ---
  switch(userRole) {
      case 'student': {
          const { data: student } = await supabase.from('students').select('id, school_id').eq('user_id', userId).single();
          if (student) {
              const { count: assignmentCount } = await supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('school_id', student.school_id).eq('class_id', student.class_id);
              dashboardData.upcomingAssignmentsCount = assignmentCount || 0;

              const { count: pendingFees } = await supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'Pending');
              dashboardData.sidebarCounts!.pendingFeePayments = pendingFees || 0;
          }
          break;
      }
      case 'teacher': {
          const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', userId).single();
          if (teacher) {
             const { count: classCount } = await supabase.from('classes').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id);
             dashboardData.assignedClassesCount = classCount || 0;

             const { data: classes } = await supabase.from('classes').select('id').eq('teacher_id', teacher.id);
             if (classes && classes.length > 0) {
                 const classIds = classes.map(c => c.id);
                 const { count: studentCount } = await supabase.from('students').select('id', { count: 'exact', head: true }).in('class_id', classIds);
                 dashboardData.totalStudentsInClasses = studentCount || 0;
             }
          }
          break;
      }
      case 'admin':
          if (schoolId) {
              const [studentsRes, teachersRes, classesRes, feesRes, expensesRes, leaveRes, tcRes] = await Promise.all([
                  supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'Active'),
                  supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
                  supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
                  supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'Pending'),
                  supabase.from('expenses').select('amount').eq('school_id', schoolId),
                  supabase.from('leave_applications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'Pending'),
                  supabase.from('tc_requests').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'Pending'),
              ]);
              
              dashboardData.totalSchoolStudents = studentsRes.count || 0;
              dashboardData.totalSchoolTeachers = teachersRes.count || 0;
              dashboardData.totalSchoolClasses = classesRes.count || 0;
              dashboardData.pendingFeesCount = feesRes.count || 0;
              dashboardData.totalExpenses = (expensesRes.data || []).reduce((sum, item) => sum + item.amount, 0);
              dashboardData.sidebarCounts!.pendingLeaveRequests = leaveRes.count || 0;
              dashboardData.sidebarCounts!.pendingTCRequests = tcRes.count || 0;
          }
          break;
      case 'superadmin': {
          const { count: schoolCount } = await supabase.from('schools').select('id', { count: 'exact', head: true });
          const { count: userCount } = await supabase.from('users').select('id', { count: 'exact', head: true });
          dashboardData.totalSchools = schoolCount || 0;
          dashboardData.totalUsers = userCount || 0;
          break;
      }
  }

  return { ok: true, data: dashboardData };
}
