
import type { LucideIcon } from 'lucide-react';

// ENUMS from DB - Ensure these match your SQL ENUM definitions
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student';
export type SchoolStatus = 'Active' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
export type LeaveRequestStatus = 'Pending AI Review' | 'Approved' | 'Rejected';
export type PaymentStatus = 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Failed';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type CourseResourceType = 'ebook' | 'video' | 'note' | 'webinar'; // Ensure singular form if DB stores singular
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

// Matches 'schools' table
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
// SchoolDetails can be an alias or extension if needed
export interface SchoolDetails extends SchoolEntry {}


// Matches 'holidays' table
export interface Holiday {
  id: string; 
  name: string;
  date: string; // Store as YYYY-MM-DD string
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'leave_applications' table
export interface StoredLeaveApplication {
  id: string; 
  student_profile_id: string; 
  student_name: string; // Name of student this leave is for
  reason: string;
  medical_notes_data_uri?: string | null;
  submission_date: string; // ISO string
  status: LeaveRequestStatus;
  ai_reasoning?: string | null;
  applicant_user_id: string; // User who submitted the application
  applicant_role: UserRole; // Role of the user who submitted
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'students' table (student profiles)
export interface Student {
  id: string; // Student Profile ID (UUID)
  user_id: string; // Foreign key to 'users' table
  name: string;
  email: string; // Denormalized from users table for convenience
  class_id?: string | null; // Foreign key to 'classes' table
  profile_picture_url?: string | null;
  date_of_birth?: string | null; // YYYY-MM-DD
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date?: string | null; // YYYY-MM-DD
  school_id: string; // Foreign key to 'schools' table
  
  // Mock fields for reports, not directly in DB students table
  lastLogin?: string; 
  mockLoginDate?: Date; 
  assignmentsSubmitted?: number; 
  attendancePercentage?: number; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'teachers' table (teacher profiles)
export interface Teacher {
  id: string; // Teacher Profile ID (UUID)
  user_id: string; // Foreign key to 'users' table
  name: string;
  email: string; // Denormalized from users table
  subject?: string | null; // Main subject, can be more complex if needed
  profile_picture_url?: string | null;
  school_id: string; // Foreign key to 'schools' table
  created_at?: string; 
  updated_at?: string; 
  
  // Mock/derived fields
  pastAssignmentsCount?: number; 
  pastClassesTaught?: string[]; 
}


// Matches 'class_names' table
export interface ClassNameRecord { 
  id: string; 
  name: string;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'section_names' table
export interface SectionRecord { 
  id: string; 
  name: string;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'classes' table (active class-sections)
export interface ClassData { 
  id: string; 
  name: string; // Denormalized class name (e.g., "Grade 10")
  division: string; // Denormalized section name (e.g., "A")
  class_name_id: string; // FK to class_names
  section_name_id: string; // FK to section_names
  teacher_id?: string | null; // FK to teachers (profile ID)
  academic_year_id?: string | null; // FK to academic_years
  school_id: string; 
  studentIds?: string[]; // Helper for UI, not a DB column
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'announcements' table
export interface Announcement {
  id:string; 
  title: string;
  content: string;
  date: string; // ISO string or YYYY-MM-DD
  author_name: string; // Person/department posting
  posted_by_user_id: string; // FK to users table
  posted_by_role: UserRole; 
  target_class_id?: string | null; // FK to classes table (for targeted announcements)
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'calendar_events' table
export interface CalendarEvent {
  id: string; 
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null; // HH:MM
  is_all_day: boolean;
  posted_by_user_id: string; // FK to users table
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'academic_years' table
export interface AcademicYear {
  id: string; 
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  school_id: string;  
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'subjects' table
export interface Subject {
  id: string; 
  name: string;
  code: string;
  academic_year_id?: string | null; // FK to academic_years
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'exams' table
export interface Exam {
  id: string; 
  name: string;
  subject_id: string; // FK to subjects
  class_id?: string | null; // FK to classes (optional, for class-specific exams)
  academic_year_id?: string | null; // FK to academic_years
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  max_marks?: number | null; 
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'assignments' table
export interface Assignment {
  id: string; 
  title: string;
  description?: string | null;
  due_date: string; // YYYY-MM-DD
  class_id: string; // FK to classes
  teacher_id: string; // FK to teachers (profile ID)
  subject_id?: string | null; // FK to subjects
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'student_scores' table
export interface StudentScore {
  id: string; 
  student_id: string; // FK to students (profile ID)
  exam_id: string; // FK to exams
  subject_id: string; // FK to subjects (denormalized for easier querying)
  class_id: string; // FK to classes (class at the time of exam)
  score: string | number; // Can be numeric or grade string
  max_marks?: number | null; // Max marks for this exam part
  recorded_by_teacher_id: string; // FK to teachers (profile ID)
  date_recorded: string; // YYYY-MM-DD
  comments?: string | null;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'admission_records' table
export interface AdmissionRecord {
  id: string; 
  name: string;
  email: string;
  date_of_birth?: string | null; // YYYY-MM-DD
  guardian_name?: string | null;
  contact_number?: string | null;
  address?: string | null;
  admission_date: string; // YYYY-MM-DD
  status: AdmissionStatus; 
  class_id?: string | null; // FK to classes (target class)
  student_profile_id?: string | null; // FK to students (profile ID, once enrolled)
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'class_schedules' table
export interface ClassScheduleItem {
  id: string; 
  class_id: string; // FK to classes
  subject_id: string; // FK to subjects
  teacher_id: string; // FK to teachers (profile ID)
  day_of_week: DayOfWeek; 
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'attendance_records' table
export interface AttendanceRecord { 
  id?: string; // DB generates UUID
  student_id: string; // FK to students (profile ID)
  class_id: string; // FK to classes
  date: string; // YYYY-MM-DD
  status: AttendanceStatus; 
  remarks?: string | null;
  taken_by_teacher_id: string; // FK to teachers (profile ID)
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Helper type for UI, not a DB table
export interface ClassAttendance { 
  classSectionId: string; // class_id from classes table
  records: AttendanceRecord[];
}

// Matches 'fee_categories' table
export interface FeeCategory {
  id: string; 
  name: string;
  description?: string | null;
  amount?: number | null; // Optional default amount
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'student_fee_payments' table
export interface StudentFeePayment {
  id: string; 
  student_id: string; // FK to students (profile ID)
  fee_category_id: string; // FK to fee_categories
  academic_year_id?: string | null; // FK to academic_years
  assigned_amount: number; 
  paid_amount: number; 
  due_date?: string | null; // YYYY-MM-DD
  payment_date?: string | null; // YYYY-MM-DD of last payment
  status: PaymentStatus; 
  notes?: string | null;
  school_id: string; 
  created_at?: string; 
  updated_at?: string; 
}


// LMS Related Types

// Matches 'lms_courses' table
export interface Course {
  id: string; 
  title: string;
  description?: string | null;
  is_paid: boolean;
  price?: number | null; 
  school_id?: string | null; // Can be global (null school_id) or school-specific
  created_by_user_id: string; // FK to users (creator)
  created_at?: string; 
  updated_at?: string; 

  // For UI convenience, not direct DB columns in lms_courses table
  resources?: { 
    ebooks: CourseResource[];
    videos: CourseResource[];
    notes: CourseResource[];
    webinars: CourseResource[];
  };
  enrolledStudentIds?: string[]; // Student Profile IDs
  enrolledTeacherIds?: string[]; // Teacher Profile IDs
}

// Matches 'lms_course_resources' table
export interface CourseResource {
  id: string; 
  course_id: string; // FK to lms_courses
  title: string;
  type: CourseResourceType; 
  url_or_content: string; // URL for external, content for notes
  file_name?: string | null; // If it's an uploaded file
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'lms_course_activation_codes' table
export interface CourseActivationCode {
  id: string; 
  course_id: string; // FK to lms_courses
  code: string; // The unique activation code
  is_used: boolean;
  used_by_user_id?: string | null; // FK to users (who used it)
  generated_date: string; // ISO string
  expiry_date?: string | null; // ISO string
  school_id?: string | null; // If codes are school-specific for a global course
  created_at?: string; 
  updated_at?: string; 
}

// Matches 'lms_student_course_enrollments' table
export interface StudentCourseEnrollment {
    id: string; 
    student_id: string; // FK to students (profile ID)
    course_id: string; // FK to lms_courses
    enrolled_at?: string; // ISO string
    school_id: string; // School of the student
}

// Matches 'lms_teacher_course_enrollments' table
export interface TeacherCourseEnrollment {
    id: string; 
    teacher_id: string; // FK to teachers (profile ID)
    course_id: string; // FK to lms_courses
    assigned_at?: string; // ISO string
    school_id: string; // School of the teacher
}

    