

import type { LucideIcon } from 'lucide-react';

// ENUMS from DB - Ensure these match your SQL ENUM definitions
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student' | 'accountant';
export type SchoolStatus = 'Active' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
export type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type PaymentStatus = 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Failed';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type CourseResourceType = 'ebook' | 'video' | 'note' | 'webinar' | 'quiz' | 'ppt' | 'audio' | 'drag_and_drop' | 'youtube_playlist' | 'web_page';
export type AdmissionStatus = 'Pending Review' | 'Admitted' | 'Enrolled' | 'Rejected';
export type TCRequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type SubscriptionPlan = 'free' | 'monthly' | 'yearly' | 'one_time';
export type FeeTypeInstallmentType = 'installments' | 'extra_charge';


export interface User {
  id: string; // UUID
  email: string;
  name: string;
  role: UserRole;
  password_hash?: string;
  school_id?: string | null;
  status?: 'Active' | 'Inactive';
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
  badgeId?: string; // ID to match with a count from the backend
};

export interface SchoolEntry {
  id: string;
  name: string;
  address?: string | null;
  admin_email: string;
  admin_name: string;
  contact_email?: string | null;
  admin_user_id?: string | null;
  status: SchoolStatus;
  contact_phone?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface SchoolDetails extends SchoolEntry {}


export interface Holiday {
  id: string;
  name: string;
  date: string; // Store as YYYY-MM-DD string
  school_id: string;
}

// For DB interactions with `leave_applications` table
export interface StoredLeaveApplicationDB {
  id: string;
  student_profile_id?: string | null;
  student_name: string;
  reason: string;
  medical_notes_data_uri?: string | null;
  medical_notes_url?: string | null;
  medical_notes_file_name?: string | null;
  medical_notes_file_path?: string | null;
  submission_date: string; // ISO string
  status: LeaveRequestStatus;
  ai_reasoning?: string | null;
  applicant_user_id: string;
  applicant_role: UserRole | 'guest';
  school_id: string;
  created_at?: string;
  updated_at?: string;
  // For joined data
  applicant?: { name: string; email: string };
  student?: { name: string; email: string; class_id?: string | null };
}

export interface Student {
  id: string; // This is students.id (student_profile_id)
  roll_number?: string | null;
  user_id: string; // This is users.id
  name: string;
  email: string;
  class_id?: string | null;
  academic_year_id?: string | null;
  profile_picture_url?: string | null;
  date_of_birth?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  nationality?: string | null;
  blood_group?: string | null;
  category?: string | null; // For SC/ST/OBC
  
  guardian_name?: string | null;
  father_name?: string | null;
  father_occupation?: string | null;
  mother_name?: string | null;
  mother_occupation?: string | null;
  annual_family_income?: number | null;
  parent_contact_number?: string | null;

  contact_number?: string | null;
  address?: string | null;
  admission_date?: string | null;
  status?: 'Active' | 'Terminated' | 'Graduated';
  school_id: string;

  lastLogin?: string;
  mockLoginDate?: Date | string;
  assignmentsSubmitted?: number;
  attendancePercentage?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Teacher {
  id: string; // This is teachers.id (teacher_profile_id)
  user_id: string; // This is users.id
  name: string;
  email: string;
  subject?: string | null;
  profile_picture_url?: string | null;
  school_id: string;
  created_at?: string;
  updated_at?: string;

  pastAssignmentsCount?: number;
  pastClassesTaught?: string[];
  lastLogin?: string;
  assignmentsPosted?: number;
  classesTaught?: number;
}


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
  studentIds?: string[];
  subjects_count?: number;
  created_at?: string;
  updated_at?: string;
}

// For DB interactions with `announcements` table
export interface AnnouncementDB {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string from DB
  author_name: string;
  posted_by_user_id: string;
  posted_by_role: UserRole;
  target_audience: 'students' | 'teachers' | 'all';
  target_class_id?: string | null;
  school_id: string | null;
  linked_exam_id?: string | null;
  created_at?: string;
  updated_at?: string;
  // For joined data
  posted_by?: { name: string; email: string };
  target_class?: { name: string; division: string };
}


// For DB interactions with `calendar_events` table
export interface CalendarEventDB {
  id: string;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD string
  start_time?: string | null; // HH:MM
  end_time?: string | null;   // HH:MM
  is_all_day: boolean;
  school_id: string;
  posted_by_user_id: string;
  // posted_by_role is not in the DB, fetched via join
  posted_by_user?: { name: string; role: UserRole };
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
  // For joined data
  class?: { name: string; division: string };
  subject?: { name: string, code: string };
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

export interface GradebookEntry {
  score: string | number;
  max_marks: number;
  student_id: string;
  exam_id: string;
  subject_id: string;
  class_id: string;
}


// Type for displaying exams with student's score information
export interface ExamWithStudentScore extends Exam {
  studentScores?: {
      subject_id: string;
      subjectName: string;
      score: string | number;
      max_marks?: number | null;
  }[] | null;
  overallResult?: {
      totalMarks: number;
      maxMarks: number;
      percentage: number;
      status: 'Pass' | 'Fail';
  };
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
  class?: ClassData | null; // For joined data
}

// For DB interactions with `class_schedules` table
export interface ClassScheduleDB {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  created_at?: string;
  updated_at?: string;
  // For joined data
  class?: { name: string; division: string };
  subject?: { name: string; code: string };
  teacher?: { name: string };
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
  class_id: string;
  date: string;
  records: {
      studentId: string;
      status: AttendanceStatus;
  }[];
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

export interface FeeType {
  id: string;
  name: string; // This is the Fee Type field
  display_name: string; // New field
  description?: string | null;
  installment_type: FeeTypeInstallmentType;
  fee_category_id: string;
  is_refundable: boolean;
  school_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface FeeTypeGroup {
  id: string;
  name: string;
  school_id: string;
  fee_type_ids: string[];
}


export interface StudentFeePayment {
  id: string;
  student_id: string;
  fee_category_id: string; // Now mandatory for all fee records
  fee_type_id?: string | null; // Optional
  fee_type_group_id?: string | null;
  academic_year_id?: string | null;
  installment_id?: string | null;
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

// New type for Fee Concessions
export interface Concession {
  id: string;
  title: string;
  description?: string | null;
  school_id: string;
  created_at?: string;
  updated_at?: string;
}

// New type for Fee Structures
export interface FeeStructure {
    id: string;
    class_id: string;
    academic_year_id: string;
    school_id: string;
    structure: Record<string, number>; // Maps fee_category_id to an amount
    created_at?: string;
    updated_at?: string;
}


export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string | null;
  school_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category_id: string;
  date: string; // YYYY-MM-DD
  receipt_url?: string | null;
  notes?: string | null;
  school_id: string;
  recorded_by_user_id: string;
  created_at?: string;
  updated_at?: string;
  // For joined data
  category?: ExpenseCategory;
  recorded_by?: { name: string };
}


export interface Course {
  id: string;
  title: string;
  description?: string | null;
  feature_image_url?: string | null;
  is_paid: boolean;
  base_price?: number | null; // New
  price_per_10_users?: number | null; // New
  currency?: 'INR' | 'USD' | 'EUR' | null;
  discount_percentage?: number | null;
  school_id?: string | null; // Null for global courses by superadmin
  created_by_user_id: string;
  created_at?: string;
  updated_at?: string;
  subscription_plan?: SubscriptionPlan | null;
}

export interface CourseWithEnrollmentStatus extends Course {
  isEnrolled?: boolean;
  target_audience_in_school?: 'student' | 'teacher' | 'both';
  subscription_end_date?: string | null;
}


// A resource that is a child of a lesson. This is a client-side type
// used to structure content in a JSON blob within a 'lesson' type CourseResource.
export interface LessonContentResource {
    id: string;
    type: CourseResourceType;
    title: string;
    // For 'note', it holds a JSON string of page content: string[]
    // For 'quiz', it holds a JSON string of QuizQuestion[]
    // For 'web_page', it holds a JSON string of WebPageContent
    // For others, it holds a URL or HTML content.
    url_or_content: string;
    duration_minutes?: number;
}

export interface WebPageSection {
    id: string;
    type: WebPageSectionType;
    content: string;
}
export type WebPageSectionType = 'heading' | 'text' | 'image';
export type WebPageTemplate = 'default' | 'article' | 'profile_card';
export interface WebPageContent {
    template: WebPageTemplate;
    sections: WebPageSection[];
    profileCardData?: {
        name?: string;
        jobTitle?: string;
        profileImageUrl?: string;
        bannerImageUrl?: string;
        description?: string;
        phone?: string;
        whatsapp?: string;
        email?: string;
        website?: string;
        address?: string;
        instagram?: string;
        facebook?: string;
        twitter?: string;
        linkedin?: string;
    }
}


export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  questionType: 'single' | 'multiple';
  correctAnswers: number[]; // Array of correct option indices
  // Deprecated, but kept for potential backward compatibility during migration
  correctAnswerIndex?: number;
}

// A resource stored in the DB.
// It can be a "lesson" which acts as a container, or a regular resource if not using lessons.
// The application interprets a resource with type 'note' as a lesson container.
export interface CourseResource {
  id: string;
  course_id: string;
  type: CourseResourceType;
  title: string;
  // For 'note' type that represents a lesson, this holds a JSON string of LessonContentResource[]
  // For other types, it holds the URL or text content.
  url_or_content: string;
  created_at?: string;
  updated_at?: string;
}

// --- Drag and Drop Activity Types ---
export type DNDTemplateType = 'matching' | 'sequencing' | 'categorization';

export interface DNDMatchingItem {
  id: string;
  prompt: string; // The item to be matched
  match: string;  // The correct match
}

export interface DNDSequencingItem {
  id: string;
  content: string; // The text of the step/item
}

export interface DNDCategorizationItem {
  id: string;
  content: string;
  category: string; // The ID of the category it belongs to
}

export interface DNDCategory {
  id: string;
  title: string;
}

export interface DNDActivityData {
  template: DNDTemplateType;
  title: string;
  instructions: string;
  // Based on the template, one of these will be populated
  matchingItems?: DNDMatchingItem[];
  sequencingItems?: DNDSequencingItem[];
  categorizationItems?: DNDCategorizationItem[];
  categories?: DNDCategory[];
}


export interface CourseActivationCode {
  id: string;
  course_id: string;
  code: string;
  is_used: boolean;
  used_by_user_id?: string | null;
  used_at?: string | null;
  generated_date: string;
  expiry_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudentCourseEnrollment {
    id: string;
    student_id: string; // This is students.id (student_profile_id)
    course_id: string;
    enrolled_at?: string;
}

export interface TeacherCourseEnrollment {
    id: string;
    teacher_id: string; // This is teachers.id (teacher_profile_id)
    course_id: string;
    assigned_at?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  school_id: string;
  submission_date: string; // ISO string
  file_path: string;
  file_name: string;
  notes?: string | null;
  grade?: string | null;
  feedback?: string | null;
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
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at?: string;
  updated_at?: string;
  submission?: AssignmentSubmission | null; // For student view
}

export interface TCRequest {
  id: string;
  student_id: string;
  school_id: string;
  request_date: string; // ISO string
  status: TCRequestStatus;
  rejection_reason?: string | null;
  approved_date?: string | null;
  created_at?: string;
  // Joined data
  student: Student;
}

export interface Accountant {
    id: string;
    user_id: string;
    school_id: string;
    name: string;
    email: string;
    profile_picture_url?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface LmsCompletion {
  id: string;
  student_id: string;
  course_id: string;
  resource_id: string;
  school_id: string;
  completed_at: string;
}

// Represents a user's favorited course
export interface UserFavoriteCourse {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
}

export interface Installment {
  id: string;
  school_id: string;
  title: string;
  amount?: number | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  last_date: string; // YYYY-MM-DD
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethod {
  id: string;
  school_id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}


declare global {
  interface Window {
    Razorpay: new (options: any) => any;
  }
}
