

import type { LucideIcon } from 'lucide-react';

// ENUMS from DB
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student' | 'staff';
export type SchoolStatus = 'Active' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
export type LeaveRequestStatus = 'Pending AI Review' | 'Approved' | 'Rejected';
export type PaymentStatus = 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Failed';
export type PayrollStatus = 'Pending' | 'Paid' | 'Processing';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type CourseResourceType = 'ebook' | 'video' | 'note' | 'webinar';
export type AdmissionStatus = 'Pending Review' | 'Admitted' | 'Enrolled' | 'Rejected';


export interface User {
  id: string; // UUID
  email: string;
  name: string;
  role: UserRole;
  password_hash?: string; // Only used server-side for creation/validation
  school_id?: string | null; // UUID, Optional: if user is directly tied to one school
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  children?: NavItem[];
};

// Represents the 'schools' table
export interface SchoolEntry { 
  id: string; // UUID
  name: string;
  address?: string | null;
  admin_email: string;
  admin_name: string;
  admin_user_id?: string | null; // UUID, Foreign key to users table
  status: SchoolStatus; 
  contact_phone?: string | null;
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// For displaying school details, could be similar to SchoolEntry or a subset
export interface SchoolDetails extends SchoolEntry {}


export interface Holiday {
  id: string; // UUID
  name: string;
  date: string; // DATE (YYYY-MM-DD string)
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'leave_applications' table
export interface StoredLeaveApplication {
  id: string; // UUID
  student_profile_id: string; // UUID, Foreign key to students (profiles) table
  student_name: string; // Name of the student (can be from form if applicant is not student)
  reason: string;
  medical_notes_data_uri?: string | null;
  submission_date: string; // TIMESTAMPTZ 
  status: LeaveRequestStatus;
  ai_reasoning?: string | null;
  applicant_user_id: string; // UUID, Foreign key to users table (user who submitted)
  applicant_role: UserRole; 
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'students' (profiles) table
export interface Student {
  id: string; // UUID, Profile ID
  user_id: string; // UUID, Foreign key to users table (for login)
  name: string;
  email: string; // Denormalized from users for convenience, or unique here
  class_id?: string | null; // UUID, Foreign key to classes table
  profile_picture_url?: string | null;
  date_of_birth?: string | null; // DATE (YYYY-MM-DD string)
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date?: string | null; // DATE (YYYY-MM-DD string)
  school_id: string; // UUID, Foreign key to schools table
  
  lastLogin?: string; // For reporting, populated dynamically
  mockLoginDate?: Date; // For client-side mock data generation
  assignmentsSubmitted?: number; // For reporting
  attendancePercentage?: number; // For reporting
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'teachers' (profiles) table
export interface Teacher {
  id: string; // UUID, Profile ID
  user_id: string; // UUID, Foreign key to users table (for login)
  name: string;
  email: string;
  subject?: string | null; // Primary subject
  profile_picture_url?: string | null;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
  
  pastAssignmentsCount?: number; // For reporting
  pastClassesTaught?: string[]; // For reporting
}

// Represents 'employees' (profiles) table
export interface Employee {
  id: string; // UUID, Profile ID
  user_id: string; // UUID, Foreign key to users table (for login)
  name: string;
  email: string;
  role_title: string; // e.g., Accountant, Librarian
  department?: string | null;
  joining_date?: string | null; // DATE (YYYY-MM-DD string)
  profile_picture_url?: string | null;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'class_names' table
export interface ClassNameRecord { 
  id: string; // UUID
  name: string;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'section_names' table
export interface SectionRecord { 
  id: string; // UUID
  name: string;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'classes' (activated class-sections) table
export interface ClassData { 
  id: string; // UUID
  name: string; // Denormalized from ClassNameRecord.name
  division: string; // Denormalized from SectionRecord.name
  class_name_id: string; // UUID, Foreign key to class_names table
  section_name_id: string; // UUID, Foreign key to section_names table
  teacher_id?: string | null; // UUID, Foreign key to teachers table (class teacher)
  academic_year_id?: string | null; // UUID, Foreign key to academic_years table
  school_id: string; // UUID, Foreign key to schools table
  studentIds: string[]; // Populated dynamically for UI, actual link is students.class_id
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'announcements' table
export interface Announcement {
  id:string; // UUID
  title: string;
  content: string;
  date: string; // TIMESTAMPTZ
  author_name: string; 
  posted_by_user_id: string; // UUID, Foreign key to users table
  posted_by_role: UserRole; 
  target_class_id?: string | null; // UUID, Foreign key to classes table
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'calendar_events' table
export interface CalendarEvent {
  id: string; // UUID
  title: string;
  description?: string | null;
  date: string; // DATE (YYYY-MM-DD string)
  start_time?: string | null; // TIME
  end_time?: string | null; // TIME
  is_all_day: boolean;
  posted_by_user_id: string; // UUID, Foreign key to users table
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'academic_years' table
export interface AcademicYear {
  id: string; // UUID
  name: string;
  start_date: string; // DATE (YYYY-MM-DD string)
  end_date: string;   // DATE (YYYY-MM-DD string)
  school_id: string;  // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'subjects' table
export interface Subject {
  id: string; // UUID
  name: string;
  code: string;
  academic_year_id?: string | null; // UUID, Foreign key to academic_years table
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'exams' table
export interface Exam {
  id: string; // UUID
  name: string;
  subject_id: string; // UUID, Foreign key to subjects table
  class_id?: string | null; // UUID, Foreign key to classes table
  academic_year_id?: string | null; // UUID, Foreign key to academic_years table
  date: string; // DATE (YYYY-MM-DD string)
  start_time?: string | null; // TIME
  end_time?: string | null;   // TIME
  max_marks?: number | null; // NUMERIC
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'assignments' table
export interface Assignment {
  id: string; // UUID
  title: string;
  description?: string | null;
  due_date: string; // DATE (YYYY-MM-DD string)
  class_id: string; // UUID, Foreign key to classes table
  teacher_id: string; // UUID, Foreign key to teachers table
  subject_id?: string | null; // UUID, Foreign key to subjects table
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'student_scores' table
export interface StudentScore {
  id: string; // UUID
  student_id: string; // UUID, Foreign key to students table
  exam_id: string; // UUID, Foreign key to exams table
  subject_id: string; // UUID, Foreign key to subjects table (denormalized)
  class_id: string; // UUID, Foreign key to classes table (class at time of exam)
  score: string | number; 
  max_marks?: number | null; // NUMERIC (denormalized from exam)
  recorded_by_teacher_id: string; // UUID, Foreign key to teachers table
  date_recorded: string; // DATE (YYYY-MM-DD string)
  comments?: string | null;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'admission_records' table
export interface AdmissionRecord {
  id: string; // UUID
  name: string;
  email: string;
  date_of_birth?: string | null; // DATE (YYYY-MM-DD string)
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date: string; // DATE (YYYY-MM-DD string)
  status: AdmissionStatus; 
  class_id?: string | null; // UUID, Foreign key to classes table (target class)
  student_profile_id?: string | null; // UUID, Foreign key to students table (once profile created)
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'class_schedules' table
export interface ClassScheduleItem {
  id: string; // UUID
  class_id: string; // UUID, Foreign key to classes table
  subject_id: string; // UUID, Foreign key to subjects table
  teacher_id: string; // UUID, Foreign key to teachers table
  day_of_week: DayOfWeek; 
  start_time: string; // TIME
  end_time: string;   // TIME
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'attendance_records' table
export interface AttendanceRecord { 
  id?: string; // UUID
  student_id: string; // UUID, Foreign key to students table
  class_id: string; // UUID, Foreign key to classes table
  date: string; // DATE (YYYY-MM-DD string)
  status: AttendanceStatus; 
  remarks?: string | null;
  taken_by_teacher_id: string; // UUID, Foreign key to teachers table
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

export interface ClassAttendance { // For client-side structure if needed
  classSectionId: string;
  records: AttendanceRecord[];
}

// Represents 'fee_categories' table
export interface FeeCategory {
  id: string; // UUID
  name: string;
  description?: string | null;
  amount?: number | null; // NUMERIC
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'student_fee_payments' table
export interface StudentFeePayment {
  id: string; // UUID
  student_id: string; // UUID, Foreign key to students table
  fee_category_id: string; // UUID, Foreign key to fee_categories table
  academic_year_id?: string | null; // UUID, Foreign key to academic_years table
  assigned_amount: number; // NUMERIC
  paid_amount: number; // NUMERIC
  due_date?: string | null; // DATE (YYYY-MM-DD string)
  payment_date?: string | null; // DATE (YYYY-MM-DD string)
  status: PaymentStatus; 
  notes?: string | null;
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'payroll_entries' table
export interface PayrollEntry {
  id: string; // UUID
  employee_id: string; // UUID, Foreign key to employees table
  designation: string;
  basic_salary: number; // NUMERIC
  payment_date?: string | null; // DATE (YYYY-MM-DD string)
  status: PayrollStatus; 
  month?: number | null; // Integer
  year?: number | null; // Integer
  school_id: string; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// LMS Types
// Represents 'lms_course_resources' table
export interface CourseResource {
  id: string; // UUID
  course_id: string; // UUID, Foreign key to lms_courses table
  title: string;
  type: CourseResourceType; 
  url_or_content: string; 
  file_name?: string | null;
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'lms_courses' table
export interface Course {
  id: string; // UUID
  title: string;
  description?: string | null;
  is_paid: boolean;
  price?: number | null; // NUMERIC
  school_id?: string | null; // UUID, Foreign key to schools table
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ

  // For client-side convenience, data will be fetched from related tables
  resources?: {
    ebooks: CourseResource[];
    videos: CourseResource[];
    notes: CourseResource[];
    webinars: CourseResource[];
  };
  enrolledStudentIds?: string[]; // Array of student UUIDs
  enrolledTeacherIds?: string[]; // Array of teacher UUIDs
}

// Represents 'lms_course_activation_codes' table
export interface CourseActivationCode {
  id: string; // UUID
  course_id: string; // UUID, Foreign key to lms_courses table
  code: string; 
  is_used: boolean;
  used_by_user_id?: string | null; // UUID, Foreign key to users table
  generated_date: string; // TIMESTAMPTZ
  expiry_date?: string | null; // TIMESTAMPTZ
  created_at?: string; // TIMESTAMPTZ
  updated_at?: string; // TIMESTAMPTZ
}

// Represents 'lms_student_course_enrollments' table
export interface StudentCourseEnrollment {
    id: string; // UUID
    student_id: string; // UUID, FK to students table
    course_id: string; // UUID, FK to lms_courses table
    enrolled_at?: string; // TIMESTAMPTZ
}

// Represents 'lms_teacher_course_enrollments' table
export interface TeacherCourseEnrollment {
    id: string; // UUID
    teacher_id: string; // UUID, FK to teachers table
    course_id: string; // UUID, FK to lms_courses table
    assigned_at?: string; // TIMESTAMPTZ
}

