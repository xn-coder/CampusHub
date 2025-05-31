
import type { LucideIcon } from 'lucide-react';

export type UserRole = 'superadmin' | 'admin' | 'teacher' | 'student';

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
  author: string;
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

// Add more types as needed
