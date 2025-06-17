
'use server';

import { createSupabaseServerClient } from '@/lib/supabaseClient';
import type { UserRole, AnnouncementDB, CalendarEventDB, Student, Teacher, SchoolEntry as School, ClassData, Assignment, LeaveRequestStatus } from '@/types';
import { subDays, startOfDay, endOfDay, addDays, formatISO } from 'date-fns';


interface DashboardData {
  // Student specific
  upcomingAssignmentsCount?: number;
  // Teacher specific
  assignedClassesCount?: number;
  totalStudentsInClasses?: number;
  pendingLeaveRequestsCount?: number;
  // Admin specific
  totalSchoolStudents?: number;
  totalSchoolTeachers?: number;
  totalSchoolClasses?: number;
  pendingAdmissionsCount?: number;
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
    const schoolId = user.school_id;

    // Fetch recent announcements (common to most roles with school context)
    if (schoolId) {
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select('id, title, date, author_name, posted_by_role, target_class:target_class_id ( name, division )')
        .eq('school_id', schoolId) // Fetch all announcements for this school
        .order('date', { ascending: false })
        .limit(3);
      if (annError) console.error("Error fetching announcements for dashboard:", annError.message);
      else dashboardData.recentAnnouncements = announcements || [];
    } else if (userRole === 'superadmin') {
        // Superadmin might see global announcements if any (schema dependent)
        // For now, no announcements if no school_id
         dashboardData.recentAnnouncements = [];
    }


    // Fetch upcoming events (common to most roles with school context)
    if (schoolId) {
      const today = formatISO(startOfDay(new Date()), { representation: 'date' });
      const nextWeek = formatISO(endOfDay(addDays(new Date(), 7)), { representation: 'date' });
      const { data: events, error: eventError } = await supabase
        .from('calendar_events')
        .select('id, title, date, start_time, is_all_day')
        .eq('school_id', schoolId)
        .gte('date', today)
        .lte('date', nextWeek)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true })
        .limit(3);
      if (eventError) console.error("Error fetching events for dashboard:", eventError.message);
      else dashboardData.upcomingEvents = events || [];
    } else if (userRole === 'superadmin') {
         dashboardData.upcomingEvents = [];
    }


    // Role-specific data fetching
    if (userRole === 'student' && schoolId) {
      const { data: studentProfile, error: studentError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('user_id', userId)
        .single();

      if (studentProfile && studentProfile.class_id) {
        const { count, error: assignmentError } = await supabase
          .from('assignments')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', studentProfile.class_id)
          .eq('school_id', schoolId)
          .gte('due_date', formatISO(new Date(), { representation: 'date' }));
        if (assignmentError) console.error("Error fetching student assignments count:", assignmentError.message);
        else dashboardData.upcomingAssignmentsCount = count ?? 0;
      }
    } else if (userRole === 'teacher' && schoolId) {
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teachers')
        .select('id') // This is teachers.id (profile_id)
        .eq('user_id', userId)
        .single();

      if (teacherProfile) {
        const teacherProfileId = teacherProfile.id;
        
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', teacherProfileId)
          .eq('school_id', schoolId);
        if (classesError) console.error("Error fetching teacher classes:", classesError.message);
        else dashboardData.assignedClassesCount = (classes || []).length;

        if (classes && classes.length > 0) {
          const classIds = classes.map(c => c.id);
          const { count: studentCount, error: studentCountError } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('class_id', classIds)
            .eq('school_id', schoolId);
          if (studentCountError) console.error("Error fetching student count for teacher:", studentCountError.message);
          else dashboardData.totalStudentsInClasses = studentCount ?? 0;

          const { count: leaveCount, error: leaveError } = await supabase
            .from('leave_applications')
            .select('id', { count: 'exact', head: true })
            .in('student_profile_id', (await supabase.from('students').select('id').in('class_id', classIds)).data?.map(s => s.id) || [])
            .eq('status', 'Approved' as LeaveRequestStatus) // Or 'Pending AI Review' if teachers manage this
            .eq('school_id', schoolId);
          if (leaveError) console.error("Error fetching pending leave requests for teacher:", leaveError.message);
          else dashboardData.pendingLeaveRequestsCount = leaveCount ?? 0;
        }
      }
    } else if (userRole === 'admin' && schoolId) {
      const [studentsRes, teachersRes, classesRes, admissionsRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('admission_records').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'Pending Review')
      ]);
      dashboardData.totalSchoolStudents = studentsRes.count ?? 0;
      dashboardData.totalSchoolTeachers = teachersRes.count ?? 0;
      dashboardData.totalSchoolClasses = classesRes.count ?? 0;
      dashboardData.pendingAdmissionsCount = admissionsRes.count ?? 0;
    } else if (userRole === 'superadmin') {
      const [schoolsRes, usersRes] = await Promise.all([
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }) // Could filter by active status if exists
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

