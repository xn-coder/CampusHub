

import type { LucideIcon } from 'lucide-react';
// Import Prisma-generated types if you want to use them directly
// import type { User as PrismaUser, School as PrismaSchool, etc } from '@prisma/client';

// User roles (matches Prisma enum)
export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student' | 'staff';

// User type for client-side use (omit sensitive fields like password)
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  // password field should NOT be here for client-side types
  // createdAt and updatedAt are available from Prisma if needed
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  children?: NavItem[];
};

// Matches Prisma's School model for superadmin management
export interface SchoolEntry { // Renamed from School to avoid conflict if using Prisma types
  id: string;
  name: string;
  address: string;
  adminEmail: string;
  adminName: string;
  status: 'Active' | 'Inactive'; // Matches Prisma enum SchoolStatus
  adminUserId?: string | null; // Foreign key to User table
  // createdAt and updatedAt are available
}

// Matches Prisma's SchoolDetails model for admin's school management
export interface SchoolDetails {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  schoolId: string; // Foreign key to School table
  // createdAt and updatedAt are available
}

// Matches Prisma's Holiday model
export interface Holiday {
  id: string;
  name: string;
  date: Date; // Prisma returns Date objects
  schoolId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's StudentLeaveApplication model
export interface StoredLeaveApplication {
  id: string;
  studentName: string;
  reason: string;
  medicalNotesDataUri?: string | null;
  submissionDate: Date; // Prisma returns Date objects
  status: 'Pending' | 'Approved' | 'Rejected'; // Matches Prisma enum
  aiReasoning?: string | null;
  applicantId: string; // Foreign key to User
  studentProfileId?: string | null; // Foreign key to Student profile
  // createdAt and updatedAt are available
}

// Matches Prisma's Student model (profile part)
export interface Student {
  id: string; // This is Student Profile ID
  userId: string; // Link to User login record
  // User details like name, email are fetched from associated User record
  classId: string; // This will be the ID from ClassData (Activated Class-Section)
  profilePictureUrl?: string | null;
  dateOfBirth?: string | null; // Keep as string for form, convert for DB
  guardianName?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  admissionDate?: string | null; // Keep as string for form, convert for DB
  
  // For reporting/activity (can be populated from related records or aggregated)
  lastLogin?: string; 
  mockLoginDate?: Date; // Used for mock data generation
  assignmentsSubmitted?: number;
  attendancePercentage?: number; 
}

// Matches Prisma's Teacher model (profile part)
export interface Teacher {
  id: string; // This is Teacher Profile ID
  userId: string; // Link to User login record
  // User details like name, email are fetched from associated User record
  subject: string; // Primary subject
  profilePictureUrl?: string | null;
  // createdAt and updatedAt are available

  // For display, could be aggregated:
  pastAssignmentsCount?: number;
  pastClassesTaught?: string[];
}

// Matches Prisma's Employee model (profile part)
export interface Employee {
  id: string; // This is Employee Profile ID
  userId: string; // Link to User login record
  // User details like name, email are fetched from associated User record
  roleDescription: string; // e.g., "Accountant", "Librarian"
  department?: string | null;
  joiningDate?: string | null; // Keep as string for form, convert for DB
  profilePictureUrl?: string | null;
  // createdAt and updatedAt are available
}

// Matches Prisma's ClassNameRecord model
export interface ClassNameRecord { 
  id: string;
  name: string;
  schoolId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's SectionRecord model
export interface SectionRecord { 
  id: string;
  name: string;
  schoolId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's ClassData model (Activated Class-Section)
export interface ClassData { 
  id: string;
  name: string; // e.g., "Grade 10"
  division: string; // e.g., "A"
  classNameRecordId: string;
  sectionRecordId: string;
  teacherId?: string | null; // Foreign key to Teacher profile ID
  academicYearId?: string | null;
  // studentIds: string[]; // This would be a relation in Prisma, fetched separately
  // createdAt and updatedAt are available
}

// Matches Prisma's Announcement model
export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: Date; // Prisma returns Date objects
  authorName: string; 
  postedByUserId: string; // Foreign key to User
  postedByRole: UserRole; // Stored for easier filtering, though derivable from User
  targetClassSectionId?: string | null; // Foreign key to ClassData
  // createdAt and updatedAt are available
}

// Matches Prisma's CalendarEvent model
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  date: string; // Keep as YYYY-MM-DD string for form, convert for DB
  startTime?: string | null; // Format HH:mm
  endTime?: string | null; // Format HH:mm
  isAllDay: boolean;
  postedByUserId: string; // Foreign key to User
  // createdAt and updatedAt are available
}

// Matches Prisma's AcademicYear model
export interface AcademicYear {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD for forms
  endDate: string;   // YYYY-MM-DD for forms
  schoolId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's Subject model
export interface Subject {
  id: string;
  name: string;
  code: string;
  academicYearId?: string | null;
  // createdAt and updatedAt are available
}

// Matches Prisma's Exam model
export interface Exam {
  id: string;
  name: string;
  subjectId: string;
  classSectionId?: string | null; 
  academicYearId?: string | null; 
  date: string; // YYYY-MM-DD for forms
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  maxMarks?: number | null; 
  // createdAt and updatedAt are available
}

// Matches Prisma's Assignment model
export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD for forms
  classSectionId: string; 
  teacherId: string; // Teacher Profile ID
  postedByUserId: string; // User ID of the teacher
  subjectId?: string | null;
  // createdAt and updatedAt are available
}

// Matches Prisma's StudentScore model
export interface StudentScore {
  id: string;
  studentId: string; // Student Profile ID
  examId: string;
  subjectId: string; 
  classSectionId: string; 
  score: string; // Stored as string to allow "A+", "Pass", or numeric
  maxMarks?: number | null; 
  recordedByTeacherId: string; // Teacher Profile ID
  recordedByUserId: string; // User ID of the teacher
  dateRecorded: string; // ISO string or Date
  comments?: string | null;
  // createdAt and updatedAt are available
}

// Matches Prisma's AdmissionRecord model
export interface AdmissionRecord {
  id: string;
  studentId: string; // Student Profile ID
  admissionDate: string; // YYYY-MM-DD for forms
  status: string; // "Pending Review", "Admitted", "Enrolled", "Rejected"
  classId?: string | null; // Assigned ClassData ID
  // createdAt and updatedAt are available
}

// Matches Prisma's ClassScheduleItem model
export interface ClassScheduleItem {
  id: string;
  classDataId: string;
  subjectId: string;
  teacherId: string; // Teacher Profile ID
  scheduledByUserId: string; // User ID (teacher or admin)
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'; // Matches Prisma enum
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  // createdAt and updatedAt are available
}

// Matches Prisma's AttendanceRecord model
export interface AttendanceRecord { 
  id: string;
  studentId: string; // Student Profile ID
  classDataId: string;
  date: string; // YYYY-MM-DD for forms
  status: 'Present' | 'Absent' | 'Late' | 'Excused'; // Matches Prisma enum
  remarks?: string | null;
  teacherProfileId: string; // Teacher Profile ID who took attendance
  takenByUserId: string; // User ID of the teacher
  // createdAt and updatedAt are available
}

// Matches Prisma's FeeCategory model
export interface FeeCategory {
  id: string;
  name: string;
  description?: string | null;
  amount?: number | null; 
  schoolId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's StudentFeePayment model
export interface StudentFeePayment {
  id: string;
  studentId: string; // Student Profile ID
  feeCategoryId: string;
  assignedAmount: number;
  paidAmount: number;
  dueDate?: string | null; // YYYY-MM-DD for forms
  paymentDate?: string | null; // YYYY-MM-DD for forms
  status: 'Pending' | 'Paid' | 'PartiallyPaid' | 'Overdue' | 'Failed'; // Matches Prisma enum
  notes?: string | null;
  academicYearId?: string | null; 
  // createdAt and updatedAt are available
}

// Matches Prisma's PayrollEntry model
export interface PayrollEntry {
  id: string;
  employeeId: string; // Employee Profile ID
  designation: string; // May be redundant with Employee.roleDescription
  basicSalary: number;
  paymentDate?: string | null; // YYYY-MM-DD for forms
  status: 'Pending' | 'Paid' | 'Processing'; // Matches Prisma enum
  schoolId: string;
  // createdAt and updatedAt are available
}

// LMS Types
// Matches Prisma's CourseResource model
export interface CourseResource {
  id: string;
  title: string;
  type: 'ebook' | 'video' | 'note' | 'webinar'; // Matches Prisma enum
  urlOrContent: string; 
  fileName?: string | null;
  courseId: string;
  // createdAt and updatedAt are available
}

// Matches Prisma's Course model
export interface Course {
  id: string;
  title: string;
  description: string;
  isPaid: boolean;
  price?: number | null;
  // schoolId?: string; // If courses are school-specific
  // createdAt and updatedAt are available

  // Relations (fetched separately)
  resources?: CourseResource[]; // Example, actual data shape depends on query
  activationCodes?: CourseActivationCode[];
  studentEnrollments?: StudentCourseEnrollment[];
  teacherEnrollments?: TeacherCourseEnrollment[];
}

// Matches Prisma's CourseActivationCode model
export interface CourseActivationCode {
  id: string;
  courseId: string;
  code: string; 
  isUsed: boolean;
  usedByUserId?: string | null; // Foreign key to User
  generatedDate: Date; // Prisma returns Date
  expiryDate?: Date | null; // Prisma returns Date
  // createdAt and updatedAt are available
}

// Matches Prisma's StudentCourseEnrollment model
export interface StudentCourseEnrollment {
  id: string;
  studentId: string; // User ID of the student
  studentProfileId: string; // Student Profile ID
  courseId: string;
  enrolledAt: Date; // Prisma returns Date
}

// Matches Prisma's TeacherCourseEnrollment model
export interface TeacherCourseEnrollment {
  id: string;
  teacherId: string; // User ID of the teacher
  teacherProfileId: string; // Teacher Profile ID
  courseId: string;
  enrolledAt: Date; // Prisma returns Date
}
