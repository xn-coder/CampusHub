
import type { LucideIcon } from 'lucide-react';

export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string; 
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  external?: boolean;
  children?: NavItem[];
};

export interface SchoolDetails {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
}

// Main leave application type used across system, stored in localStorage
export interface StoredLeaveApplication {
  id: string;          // Unique ID for the application
  studentName: string; // Name of the student as entered in the form
  studentId?: string;  // Actual ID of the student if a student user submitted it
  reason: string;
  medicalNotesDataUri?: string; // If a file was uploaded
  submissionDate: string; // ISO string, date of submission
  status: 'Approved' | 'Rejected' | 'Pending AI Review'; // Status after AI processing or while pending
  aiReasoning?: string; // Explanation from AI
  applicantRole: UserRole | 'guest'; // Role of the user who submitted the form
}


export interface Student {
  id: string;
  name: string;
  email: string;
  classId: string; 
  profilePictureUrl?: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  admissionDate?: string;
  // For Reports
  lastLogin?: string; 
  mockLoginDate?: Date; 
  assignmentsSubmitted?: number;
  attendancePercentage?: number; 
}

export interface AdmissionRecord {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string; 
  guardianName: string;
  contactNumber: string;
  address: string;
  admissionDate: string; 
  status: 'Pending Review' | 'Admitted' | 'Rejected' | 'Enrolled';
  classId: string; 
}


export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string; // Primary subject
  profilePictureUrl?: string;
  // For mock history
  pastAssignmentsCount?: number;
  pastClassesTaught?: string[];
}

export interface ClassNameRecord { // e.g., "Grade 10", "Year 5"
  id: string;
  name: string;
}

export interface SectionRecord { // e.g., "A", "Blue", "Rose"
  id: string;
  name: string;
}

export interface ClassData { // Represents an "Activated Class-Section"
  id: string;
  name: string; // Name from ClassNameRecord
  division: string; // Name from SectionRecord
  teacherId?: string; // ID of the assigned teacher
  studentIds: string[]; // IDs of students enrolled
}

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: Date;
  authorName: string; 
  postedByRole: UserRole; 
  targetClassSectionId?: string; // ID of ClassData if targeted
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // Store as ISO string 'yyyy-MM-dd' for localStorage compatibility
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}

export interface ClassScheduleItem {
  id: string;
  className: string; 
  subject: string;
  teacherName: string; 
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; 
  endTime: string; 
}

export interface PayrollEntry {
  id: string;
  employeeName: string;
  designation: string;
  basicSalary: number;
  paymentDate?: string; 
  status: 'Pending' | 'Paid' | 'Processing';
}

export interface AttendanceRecord { // Record for a single student on a single day
  studentId: string;
  date: string; // yyyy-MM-dd
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  remarks?: string;
}

export interface ClassAttendance { // Daily attendance for a whole class-section
  classSectionId: string; // ID of ClassData
  records: AttendanceRecord[];
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string; // ISO string 'yyyy-MM-dd'
  endDate: string; // ISO string 'yyyy-MM-dd'
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  academicYearId?: string; 
}

export interface Exam {
  id: string;
  name: string;
  subjectId: string;
  classSectionId?: string; 
  academicYearId?: string; 
  date: string; 
  startTime: string; 
  endTime: string; 
  maxMarks?: number; // Optional max marks for an exam
}

export interface SchoolEntry {
  id: string;
  name: string;
  address: string; 
  adminEmail: string;
  adminName: string;
  status?: 'Active' | 'Inactive'; 
}

// New type for Teacher Assignments
export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string 'yyyy-MM-dd'
  classSectionId: string; // ID of the target ClassData
  teacherId: string; // ID of the teacher who posted
  // Optional fields for future enhancement
  // files?: { name: string, url: string }[]; 
  // submissions?: { studentId: string, submittedAt: string, fileUrl?: string, content?: string, grade?: string }[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string; // e.g., Accountant, Librarian, Support Staff
  department: string;
  joiningDate: string; // ISO String
  profilePictureUrl?: string;
}

export interface FeeCategory {
  id: string;
  name: string;
  description: string;
  amount?: number; // Optional fixed amount for the category
}

export interface StudentScore {
  id: string;
  studentId: string;
  examId: string;
  subjectId: string; // From the exam
  classSectionId: string; // From the exam or student's class at time of exam
  score: number | string; // Numeric score or grade like "A+"
  maxMarks?: number; // Max marks for the exam, for context
  recordedByTeacherId: string;
  dateRecorded: string; // ISO string
  comments?: string;
}


export interface StudentFeePayment {
  id: string;
  studentId: string;
  feeCategoryId: string;
  assignedAmount: number;
  paidAmount: number;
  dueDate?: string; // ISO Date string
  paymentDate?: string; // ISO Date string for the last payment
  status: 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue';
  notes?: string;
  academicYearId?: string; // Optional link to academic year
}
