
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
  classId: string; 
  profilePictureUrl?: string;
  dateOfBirth?: string; 
  guardianName?: string;
  contactNumber?: string;
  address?: string;
  admissionDate?: string; 
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
}


export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  profilePictureUrl?: string;
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
  paymentDate?: string; // ISO string
  status: 'Pending' | 'Paid' | 'Processing';
}

// Add more types as needed

      
