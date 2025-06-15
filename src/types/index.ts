

import type { LucideIcon } from 'lucide-react';

export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash?: string; // Only used server-side for creation/validation
  createdAt?: string;
  updatedAt?: string;
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  children?: NavItem[];
};

export type SchoolStatus = 'Active' | 'Inactive';

export interface SchoolEntry { 
  id: string;
  name: string;
  address: string;
  adminEmail: string;
  adminName: string;
  status: SchoolStatus; 
  adminUserId: string; 
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolDetails {
  id: string; // This would be the ID of the school record itself.
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  // schoolId field is removed as this interface represents the school itself.
  createdAt?: string;
  updatedAt?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date; // Keep as Date for client-side, string 'yyyy-MM-dd' for DB
  schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredLeaveApplication {
  id: string;
  studentName: string;
  reason: string;
  medicalNotesDataUri?: string | null;
  submissionDate: string; 
  status: 'Pending AI Review' | 'Approved' | 'Rejected';
  aiReasoning?: string | null;
  applicantId: string; 
  studentProfileId?: string | null; 
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string; 
  name: string;
  email: string;
  classId: string; 
  profilePictureUrl?: string | null;
  dateOfBirth?: string | null; 
  guardianName?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  admissionDate?: string | null; 
  userId?: string; // ID from the main 'users' table for login

  // For reporting/activity (can be populated from related records or aggregated)
  lastLogin?: string; 
  mockLoginDate?: Date; 
  assignmentsSubmitted?: number;
  attendancePercentage?: number; 
  createdAt?: string;
  updatedAt?: string;
}

export interface Teacher {
  id: string; 
  name: string;
  email: string; 
  subject: string; 
  profilePictureUrl?: string | null;
  userId?: string; // ID from the main 'users' table for login
  createdAt?: string;
  updatedAt?: string;
  
  pastAssignmentsCount?: number;
  pastClassesTaught?: string[];
}

export interface Employee {
  id: string; 
  name: string; // From User record
  email: string; // From User record
  role: string; // Specific role like 'Accountant', 'Librarian'
  department?: string | null;
  joiningDate: string; // YYYY-MM-DD
  profilePictureUrl?: string | null;
  userId?: string; // ID from the main 'users' table for login
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassNameRecord { 
  id: string;
  name: string;
  // schoolId: string; // If class names are school-specific
  createdAt?: string;
  updatedAt?: string;
}

export interface SectionRecord { 
  id: string;
  name: string;
  // schoolId: string; // If section names are school-specific
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassData { 
  id: string;
  name: string; 
  division: string; 
  // classNameRecordId: string; // Link to ClassNameRecord
  // sectionRecordId: string;   // Link to SectionRecord
  teacherId?: string | null; 
  academicYearId?: string | null;
  studentIds: string[]; // Array of student IDs (Student profile IDs)
  // schoolId: string; // If class-sections are school-specific
  createdAt?: string;
  updatedAt?: string;
}

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: Date; 
  authorName: string; 
  // postedByUserId: string; 
  postedByRole: UserRole; 
  targetClassSectionId?: string | null; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  date: string; 
  startTime?: string | null; 
  endTime?: string | null; 
  isAllDay: boolean;
  // postedByUserId: string; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  schoolId: string;  // Foreign Key to schools table
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  academicYearId?: string | null;
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Exam {
  id: string;
  name: string;
  subjectId: string;
  classSectionId?: string | null; 
  academicYearId?: string | null; 
  date: string; 
  startTime: string; 
  endTime: string;   
  maxMarks?: number | null; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; 
  classSectionId: string; 
  teacherId: string; // Teacher profile ID (from 'teachers' table or 'users' table if teachers are just users with a role)
  // postedByUserId: string; // User ID of the teacher
  subjectId?: string | null;
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentScore {
  id: string;
  studentId: string; 
  examId: string;
  subjectId: string; 
  classSectionId: string; 
  score: string | number; // Allow string for grades like 'A+' or number for marks
  maxMarks?: number | null; 
  recordedByTeacherId: string; 
  // recordedByUserId: string; 
  dateRecorded: string; 
  comments?: string | null;
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionRecord {
  id: string;
  name: string; // Student's name
  email: string; // Student's email
  dateOfBirth: string;
  guardianName: string;
  contactNumber: string;
  address: string;
  admissionDate: string; 
  status: 'Pending Review' | 'Admitted' | 'Enrolled' | 'Rejected'; 
  classId?: string | null; 
  // schoolId: string;
  // studentId: string; // This would be the ID from the main 'students' (profile) table once created
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassScheduleItem {
  id: string;
  // classDataId: string;
  className: string; // e.g. "Grade 10A" (derived or stored)
  subject: string; // e.g. "Mathematics"
  teacherName: string; // e.g. "Mr. Smith"
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'; 
  startTime: string; 
  endTime: string;   
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord { 
  id?: string; // Optional if auto-generated by DB
  studentId: string; 
  // classDataId: string;
  date: string; 
  status: 'Present' | 'Absent' | 'Late' | 'Excused'; 
  remarks?: string | null;
  // teacherProfileId: string; 
  // takenByUserId: string; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

// For class-level attendance, primarily used for storage in localStorage
export interface ClassAttendance {
  classSectionId: string;
  records: AttendanceRecord[];
}


export interface FeeCategory {
  id: string;
  name: string;
  description: string;
  amount?: number; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentFeePayment {
  id: string;
  studentId: string; 
  feeCategoryId: string;
  assignedAmount: number;
  paidAmount: number;
  dueDate?: string | null; 
  paymentDate?: string | null; 
  status: 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Failed'; 
  notes?: string | null;
  academicYearId?: string | null; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollEntry {
  id: string;
  employeeName: string; // Should link to an Employee ID in a real system
  // employeeId: string; 
  designation: string; 
  basicSalary: number;
  paymentDate?: string | null; 
  status: 'Pending' | 'Paid' | 'Processing'; 
  // schoolId: string;
  createdAt?: string;
  updatedAt?: string;
}

// LMS Types
export interface CourseResource {
  id: string;
  title: string;
  type: 'ebook' | 'video' | 'note' | 'webinar'; 
  urlOrContent: string; 
  fileName?: string | null;
  // courseId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  isPaid: boolean;
  price?: number;
  // schoolId?: string; 
  createdAt?: string;
  updatedAt?: string;

  resources: {
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
  courseId: string;
  code: string; 
  isUsed: boolean;
  usedByUserId?: string | null; 
  generatedDate: string; // ISO String
  expiryDate?: string | null; // ISO String
  createdAt?: string;
  updatedAt?: string;
}

// StudentCourseEnrollment and TeacherCourseEnrollment are implicitly handled
// by enrolledStudentIds and enrolledTeacherIds arrays in the Course type for localStorage.
// For a DB, these would be separate join tables.

