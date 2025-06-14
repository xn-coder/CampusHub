
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

export interface StoredLeaveApplication {
  id: string;
  studentName: string; 
  studentId?: string; 
  reason: string;
  medicalNotesDataUri?: string; 
  submissionDate: string; 
  status: 'Approved' | 'Rejected' | 'Pending AI Review'; 
  aiReasoning?: string; 
  applicantRole: UserRole | 'guest'; 
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
  subject: string; 
  profilePictureUrl?: string;
  pastAssignmentsCount?: number;
  pastClassesTaught?: string[];
}

export interface ClassNameRecord { 
  id: string;
  name: string;
}

export interface SectionRecord { 
  id: string;
  name: string;
}

export interface ClassData { 
  id: string;
  name: string; 
  division: string; 
  teacherId?: string; 
  studentIds: string[]; 
}

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: Date;
  authorName: string; 
  postedByRole: UserRole; 
  targetClassSectionId?: string; 
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; 
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

export interface AttendanceRecord { 
  studentId: string;
  date: string; 
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  remarks?: string;
}

export interface ClassAttendance { 
  classSectionId: string; 
  records: AttendanceRecord[];
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string; 
  endDate: string; 
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
  maxMarks?: number; 
}

export interface SchoolEntry {
  id: string;
  name: string;
  address: string; 
  adminEmail: string;
  adminName: string;
  status?: 'Active' | 'Inactive'; 
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; 
  classSectionId: string; 
  teacherId: string; 
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string; 
  department: string;
  joiningDate: string; 
  profilePictureUrl?: string;
}

export interface FeeCategory {
  id: string;
  name: string;
  description: string;
  amount?: number; 
}

export interface StudentScore {
  id: string;
  studentId: string;
  examId: string;
  subjectId: string; 
  classSectionId: string; 
  score: number | string; 
  maxMarks?: number; 
  recordedByTeacherId: string;
  dateRecorded: string; 
  comments?: string;
}


export interface StudentFeePayment {
  id: string;
  studentId: string;
  feeCategoryId: string;
  assignedAmount: number;
  paidAmount: number;
  dueDate?: string; 
  paymentDate?: string; 
  status: 'Pending' | 'Paid' | 'Partially Paid' | 'Overdue';
  notes?: string;
  academicYearId?: string; 
}

// LMS Types
export interface CourseResource {
  id: string;
  title: string;
  type: 'ebook' | 'video' | 'note' | 'webinar';
  urlOrContent: string; // URL for video/ebook, text for note, meeting link for webinar
  fileName?: string; // Optional for uploaded files
}

export interface Course {
  id: string;
  title: string;
  description: string;
  isPaid: boolean;
  price?: number;
  resources: {
    ebooks: CourseResource[];
    videos: CourseResource[];
    notes: CourseResource[];
    webinars: CourseResource[];
  };
  enrolledStudentIds: string[];
  enrolledTeacherIds: string[];
  // Add thumbnail/cover image URL if needed
  // coverImageUrl?: string;
}

export interface CourseActivationCode {
  id: string;
  courseId: string;
  code: string; // The unique activation code
  isUsed: boolean;
  usedByStudentId?: string; // ID of the student who used it
  generatedDate: string; // ISO date string
  expiryDate?: string; // Optional expiry for the code
}
