

'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole, AnnouncementDB, CalendarEventDB, Student, Teacher, SchoolEntry as School, ClassData, Assignment, LeaveRequestStatus, Expense } from '@/types';
import { subDays, startOfDay, endOfDay, addDays, formatISO } from 'date-fns';
import { checkStudentFeeStatusAction } from '@/app/(app)/admin/student-fees/actions';


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
}


export async function getDashboardDataAction(userId: string, userRole: UserRole): Promise<{ ok: boolean; data?: DashboardData; message?: string }> {
  const supabase = createSupabaseServerClient();
  const dashboardData: DashboardData = {};

  try {
    // Fetch common user details and school context
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, school_id, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { ok: false, message: "User context not found." };
    }
    
    let effectiveSchoolId = user.school_id;

    // Fallback for admin if users.school_id is null
    if (userRole === 'admin' && !effectiveSchoolId && userId) {
      const { data: schoolAdminRec, error: schoolAdminError } = await supabase
        .from('schools')
        .select('id')
        .eq('admin_user_id', userId)
        .single();
      if (schoolAdminError && schoolAdminError.code !== 'PGRST116') { // PGRST116 means no rows, which is a valid outcome here
        console.error("Dashboard: Error fetching school for admin via admin_user_id:", schoolAdminError.message);
      } else if (schoolAdminRec) {
        effectiveSchoolId = schoolAdminRec.id; // Use school_id from schools table
      }
    }

    // Fetch common data (announcements, events) if a school context (effectiveSchoolId) exists
    // This applies to students, teachers, and admins who are linked to a school.
    if (effectiveSchoolId && (userRole === 'student' || userRole === 'teacher' || userRole === 'admin')) {
      // Fetch recent announcements
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select('id, title, date, author_name, posted_by_role, target_class:target_class_id ( name, division )')
        .eq('school_id', effectiveSchoolId) // All announcements for this school
        .order('date', { ascending: false })
        .limit(3);
      if (annError) console.error("Error fetching announcements for dashboard:", annError.message);
      else dashboardData.recentAnnouncements = announcements || [];

      // Fetch upcoming events
      const today = formatISO(startOfDay(new Date()), { representation: 'date' });
      const nextWeek = formatISO(endOfDay(addDays(new Date(), 7)), { representation: 'date' });
      const { data: events, error: eventError } = await supabase
        .from('calendar_events')
        .select('id, title, date, start_time, is_all_day')
        .eq('school_id', effectiveSchoolId)
        .gte('date', today)
        .lte('date', nextWeek)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true })
        .limit(3);
      if (eventError) console.error("Error fetching events for dashboard:", eventError.message);
      else dashboardData.upcomingEvents = events || [];
    } else if (userRole === 'superadmin' || !effectiveSchoolId) {
        // Superadmin or roles without a determined school context see no school-specific common data
        dashboardData.recentAnnouncements = [];
        dashboardData.upcomingEvents = [];
    }


    // Role-specific data fetching
    if (userRole === 'student' && effectiveSchoolId) {
      const { data: studentProfile, error: studentError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('user_id', userId)
        .single();

      if (studentProfile) {
        if (studentProfile.class_id) {
            const { count, error: assignmentError } = await supabase
            .from('assignments')
            .select('id', { count: 'exact', head: true })
            .eq('class_id', studentProfile.class_id)
            .eq('school_id', effectiveSchoolId)
            .gte('due_date', formatISO(new Date(), { representation: 'date' }));
            if (assignmentError) console.error("Error fetching student assignments count:", assignmentError.message);
            else dashboardData.upcomingAssignmentsCount = count ?? 0;
        }

        // Check fee status
        const feeStatusResult = await checkStudentFeeStatusAction(studentProfile.id, effectiveSchoolId);
        if (feeStatusResult.ok) {
            dashboardData.feeStatus = { isDefaulter: feeStatusResult.isDefaulter, message: feeStatusResult.message };
        }
      }
    } else if (userRole === 'teacher' && effectiveSchoolId) {
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teachers')
        .select('id') 
        .eq('user_id', userId)
        .single();

      if (teacherProfile) {
        const teacherProfileId = teacherProfile.id;
        
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', teacherProfileId)
          .eq('school_id', effectiveSchoolId);
        if (classesError) console.error("Error fetching teacher classes:", classesError.message);
        else dashboardData.assignedClassesCount = (classes || []).length;

        if (classes && classes.length > 0) {
          const classIds = classes.map(c => c.id);
          const { count: studentCount, error: studentCountError } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classIds)
            .eq('school_id', effectiveSchoolId);
          if (studentCountError) console.error("Error fetching student count for teacher:", studentCountError.message);
          else dashboardData.totalStudentsInClasses = studentCount ?? 0;

          // Fetch students belonging to the teacher's classes to get their profile IDs
          const {data: studentsInTeacherClasses, error: studentsForLeaveError } = await supabase
            .from('students')
            .select('id')
            .in('class_id', classIds)
            .eq('school_id', effectiveSchoolId);

          if (studentsForLeaveError) {
            console.error("Error fetching student profiles for teacher's leave requests:", studentsForLeaveError.message);
            dashboardData.pendingLeaveRequestsCount = 0;
          } else if (studentsInTeacherClasses && studentsInTeacherClasses.length > 0) {
            const studentProfileIds = studentsInTeacherClasses.map(s => s.id);
            const { count: leaveCount, error: leaveError } = await supabase
              .from('leave_applications')
              .select('id', { count: 'exact', head: true })
              .in('student_profile_id', studentProfileIds)
              .eq('status', 'Approved' as LeaveRequestStatus) 
              .eq('school_id', effectiveSchoolId);
            if (leaveError) console.error("Error fetching pending leave requests for teacher:", leaveError.message);
            else dashboardData.pendingLeaveRequestsCount = leaveCount ?? 0;
          } else {
            dashboardData.pendingLeaveRequestsCount = 0; // No students in classes
          }
        }
      }
    } else if (userRole === 'admin') {
        if (effectiveSchoolId) { // Admin has a school context
            const [studentsRes, teachersRes, classesRes, admissionsRes, feesRes, expensesRes] = await Promise.all([
                supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', effectiveSchoolId),
                supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', effectiveSchoolId),
                supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', effectiveSchoolId),
                supabase.from('admission_records').select('id', { count: 'exact', head: true }).eq('school_id', effectiveSchoolId).eq('status', 'Pending Review'),
                supabase.from('student_fee_payments').select('id', { count: 'exact', head: true }).eq('school_id', effectiveSchoolId).in('status', ['Pending', 'Partially Paid', 'Overdue']),
                supabase.from('expenses').select('amount').eq('school_id', effectiveSchoolId)
            ]);
            dashboardData.totalSchoolStudents = studentsRes.count ?? 0;
            dashboardData.totalSchoolTeachers = teachersRes.count ?? 0;
            dashboardData.totalSchoolClasses = classesRes.count ?? 0;
            dashboardData.pendingAdmissionsCount = admissionsRes.count ?? 0;
            dashboardData.pendingFeesCount = feesRes.count ?? 0;
            dashboardData.totalExpenses = (expensesRes.data || []).reduce((acc, exp) => acc + exp.amount, 0);

        } else { // Admin not linked to any school
            dashboardData.totalSchoolStudents = 0;
            dashboardData.totalSchoolTeachers = 0;
            dashboardData.totalSchoolClasses = 0;
            dashboardData.pendingAdmissionsCount = 0;
            dashboardData.pendingFeesCount = 0;
            dashboardData.totalExpenses = 0;
        }
    } else if (userRole === 'superadmin') {
      const [schoolsRes, usersRes] = await Promise.all([
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }) 
      ]);
      dashboardData.totalSchools = schoolsRes.count ?? 0;
      dashboardData.totalUsers = usersRes.count ?? 0;
    }

    return { ok: true, data: dashboardData };
  } catch (error: any) {
    console.error("Error fetching dashboard data:", error);
    return { ok: false, message: error.message || "An unexpected error occurred." };
  }
}
