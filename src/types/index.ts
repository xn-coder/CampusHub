
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

export interface LeaveApplication {
  id: string;
  studentName: string;
  reason: string;
  medicalNotesUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decisionReason?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  classId: string; // Stores the ID of the ClassData object (activated class-section)
  profilePictureUrl?: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  admissionDate?: string;
  lastLogin?: string; // ISO Date string for display
  mockLoginDate?: Date; // Actual Date object for easier sorting
  assignmentsSubmitted?: number;
  attendancePercentage?: number; // 0-100
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
  classId: string; // ID of the ClassData object student is admitted to
}


export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  profilePictureUrl?: string;
}

// Represents a standard or grade level, e.g., "Grade 10", "Senior KG"
export interface ClassNameRecord {
  id: string;
  name: string;
}

// Represents a division or section, e.g., "A", "Rose Section"
export interface SectionRecord {
  id: string;
  name: string;
}

// Represents an "activated" or "instantiated" class-section combination
// to which students and teachers are assigned.
export interface ClassData {
  id: string;
  name: string; // Name from ClassNameRecord, e.g., "Grade 10"
  division: string; // Name from SectionRecord, e.g., "A"
  teacherId?: string;
  studentIds: string[]; // List of student IDs assigned to this class-division
}

export interface Announcement {
  id:string;
  title: string;
  content: string;
  date: Date;
  authorName: string; 
  postedByRole: UserRole; 
  targetClassSectionId?: string; // Optional: ID of the ClassData for targeted announcements
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}

export interface ClassScheduleItem {
  id: string;
  className: string; // e.g. "Grade 10A" or could be linked to ClassData.id
  subject: string;
  teacherName: string; // or Teacher.id
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
}

export interface PayrollEntry {
  id: string;
  employeeName: string;
  designation: string;
  basicSalary: number;
  paymentDate?: string; // ISO string
  status: 'Pending' | 'Paid' | 'Processing';
}

export interface AttendanceRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  remarks?: string;
}

export interface ClassAttendance {
  classSectionId: string; // ID of the ClassData
  records: AttendanceRecord[];
}

