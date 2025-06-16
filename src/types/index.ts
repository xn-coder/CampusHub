
import type { LucideIcon } from 'lucide-react';

// ENUMS from DB
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student'; // Removed 'staff'
export type SchoolStatus = 'Active' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
export type LeaveRequestStatus = 'Pending AI Review' | 'Approved' | 'Rejected';
export type PaymentStatus = 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Failed';
// export type PayrollStatus = 'Pending' | 'Paid' | 'Processing'; // Removed as PayrollEntry is removed
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type CourseResourceType = 'ebook' | 'video' | 'note' | 'webinar';
export type AdmissionStatus = 'Pending Review' | 'Admitted' | 'Enrolled' | 'Rejected';


export interface User {
  id: string; // UUID
  email: string;
  name: string;
  role: UserRole;
  password_hash?: string; 
  school_id?: string | null; 
  created_at?: string; 
  updated_at?: string; 
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  children?: NavItem[];
};

export interface SchoolEntry { 
  id: string; 
  name: string;
  address?: string | null;
  admin_email: string;
  admin_name: string;
  admin_user_id?: string | null; 
  status: SchoolStatus; 
  contact_phone?: string | null;
  created_at?: string; 
  updated_at?: string; 
}

export interface SchoolDetails extends SchoolEntry {}


export interface Holiday {
  id: string; 
  name: string;
  date: string; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface StoredLeaveApplication {
  id: string; 
  student_profile_id: string; 
  student_name: string; 
  reason: string;
  medical_notes_data_uri?: string | null;
  submission_date: string; 
  status: LeaveRequestStatus;
  ai_reasoning?: string | null;
  applicant_user_id: string; 
  applicant_role: UserRole; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface Student {
  id: string; 
  user_id: string; 
  name: string;
  email: string; 
  class_id?: string | null; 
  profile_picture_url?: string | null;
  date_of_birth?: string | null; 
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date?: string | null; 
  school_id: string; 
  
  lastLogin?: string; 
  mockLoginDate?: Date; 
  assignmentsSubmitted?: number; 
  attendancePercentage?: number; 
  created_at?: string; 
  updated_at?: string; 
}

export interface Teacher {
  id: string; 
  user_id: string; 
  name: string;
  email: string;
  subject?: string | null; 
  profile_picture_url?: string | null;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
  
  pastAssignmentsCount?: number; 
  pastClassesTaught?: string[]; 
}

// Employee and PayrollEntry types are removed

export interface ClassNameRecord { 
  id: string; 
  name: string;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface SectionRecord { 
  id: string; 
  name: string;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface ClassData { 
  id: string; 
  name: string; 
  division: string; 
  class_name_id: string; 
  section_name_id: string; 
  teacher_id?: string | null; 
  academic_year_id?: string | null; 
  school_id: string; 
  studentIds: string[]; 
  created_at?: string; 
  updated_at?: string; 
}

export interface Announcement {
  id:string; 
  title: string;
  content: string;
  date: string; 
  author_name: string; 
  posted_by_user_id: string; 
  posted_by_role: UserRole; 
  target_class_id?: string | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface CalendarEvent {
  id: string; 
  title: string;
  description?: string | null;
  date: string; 
  start_time?: string | null; 
  end_time?: string | null; 
  is_all_day: boolean;
  posted_by_user_id: string; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface AcademicYear {
  id: string; 
  name: string;
  start_date: string; 
  end_date: string;   
  school_id: string;  
  created_at?: string; 
  updated_at?: string; 
}

export interface Subject {
  id: string; 
  name: string;
  code: string;
  academic_year_id?: string | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface Exam {
  id: string; 
  name: string;
  subject_id: string; 
  class_id?: string | null; 
  academic_year_id?: string | null; 
  date: string; 
  start_time?: string | null; 
  end_time?: string | null;   
  max_marks?: number | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface Assignment {
  id: string; 
  title: string;
  description?: string | null;
  due_date: string; 
  class_id: string; 
  teacher_id: string; 
  subject_id?: string | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface StudentScore {
  id: string; 
  student_id: string; 
  exam_id: string; 
  subject_id: string; 
  class_id: string; 
  score: string | number; 
  max_marks?: number | null; 
  recorded_by_teacher_id: string; 
  date_recorded: string; 
  comments?: string | null;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface AdmissionRecord {
  id: string; 
  name: string;
  email: string;
  date_of_birth?: string | null; 
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date: string; 
  status: AdmissionStatus; 
  class_id?: string | null; 
  student_profile_id?: string | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface ClassScheduleItem {
  id: string; 
  class_id: string; 
  subject_id: string; 
  teacher_id: string; 
  day_of_week: DayOfWeek; 
  start_time: string; 
  end_time: string;   
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface AttendanceRecord { 
  id?: string; 
  student_id: string; 
  class_id: string; 
  date: string; 
  status: AttendanceStatus; 
  remarks?: string | null;
  taken_by_teacher_id: string; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface ClassAttendance { 
  classSectionId: string;
  records: AttendanceRecord[];
}

export interface FeeCategory {
  id: string; 
  name: string;
  description?: string | null;
  amount?: number | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

export interface StudentFeePayment {
  id: string; 
  student_id: string; 
  fee_category_id: string; 
  academic_year_id?: string | null; 
  assigned_amount: number; 
  paid_amount: number; 
  due_date?: string | null; 
  payment_date?: string | null; 
  status: PaymentStatus; 
  notes?: string | null;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// PayrollEntry removed

export interface CourseResource {
  id: string; 
  course_id: string; 
  title: string;
  type: CourseResourceType; 
  url_or_content: string; 
  file_name?: string | null;
  created_at?: string; 
  updated_at?: string; 
}

export interface Course {
  id: string; 
  title: string;
  description?: string | null;
  is_paid: boolean;
  price?: number | null; 
  school_id?: string | null; 
  created_at?: string; 
  updated_at?: string; 

  resources?: {
    ebooks: CourseResource[];
    videos: CourseResource[];
    notes: CourseResource[];
    webinars: CourseResource[];
  };
  enrolledStudentIds?: string[]; 
  enrolledTeacherIds?: string[]; 
}

export interface CourseActivationCode {
  id: string; 
  course_id: string; 
  code: string; 
  is_used: boolean;
  used_by_user_id?: string | null; 
  generated_date: string; 
  expiry_date?: string | null; 
  created_at?: string; 
  updated_at?: string; 
}

export interface StudentCourseEnrollment {
    id: string; 
    student_id: string; 
    course_id: string; 
    enrolled_at?: string; 
}

export interface TeacherCourseEnrollment {
    id: string; 
    teacher_id: string; 
    course_id: string; 
    assigned_at?: string; 
}
