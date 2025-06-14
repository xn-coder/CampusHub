
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { UserRole, Student, ClassData } from '@/types'; // Assuming StoredLeaveApplication will be added
import { useState, useEffect } from 'react';
import { ClipboardCheck, ExternalLink, User, CalendarDays, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// This type should match the one in leave-form.tsx or be imported if centralized
interface StoredLeaveApplication {
  id: string;
  studentName: string; 
  studentId?: string; 
  applicantRole: UserRole | 'guest';
  reason: string;
  medicalNotesDataUri?: string;
  submissionDate: string; 
  status: 'Pending AI Review' | 'Approved' | 'Rejected'; // Reflects AI decision
  aiReasoning?: string;
}

const MOCK_ALL_LEAVE_APPLICATIONS_KEY = 'mockAllLeaveApplicationsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';

export default function TeacherLeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<StoredLeaveApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const currentTeacherId = localStorage.getItem('currentUserId');
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const allClasses: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
      const assignedClassIds = allClasses.filter(c => c.teacherId === currentTeacherId).map(c => c.id);
      setTeacherClassIds(assignedClassIds);

      const storedApplications = localStorage.getItem(MOCK_ALL_LEAVE_APPLICATIONS_KEY);
      const allApplications: StoredLeaveApplication[] = storedApplications ? JSON.parse(storedApplications) : [];
      
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      const allStudents: Student[] = storedStudents ? JSON.parse(storedStudents) : [];

      // Filter applications for students in the teacher's classes
      const teacherStudentApplications = allApplications.filter(app => {
        if (app.studentId) { // If studentId is present (student applied for themselves)
          const student = allStudents.find(s => s.id === app.studentId);
          return student && assignedClassIds.includes(student.classId);
        }
        // If studentId is not present, it might be an application made by someone else FOR a student.
        // This scenario requires more robust linking of application to student, perhaps by student name if studentId is missing.
        // For simplicity now, we focus on studentId. A more complex system would be needed for applications not made by students themselves.
        return false; 
      });
      
      setLeaveRequests(teacherStudentApplications.sort((a,b) => parseISO(b.submissionDate).getTime() - parseISO(a.submissionDate).getTime()));
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Leave Requests" 
        description="View and manage leave applications submitted by students in your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardCheck className="mr-2 h-5 w-5" />Leave Applications for Your Students</CardTitle>
          <CardDescription>Review AI-processed leave requests. For overrides or issues, contact administration.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading leave requests...</p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No leave requests found from students in your classes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><User className="inline-block mr-1 h-4 w-4"/>Student Name</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Submitted</TableHead>
                  <TableHead><MessageSquare className="inline-block mr-1 h-4 w-4"/>Reason</TableHead>
                  <TableHead>Medical Note</TableHead>
                  <TableHead className="text-center">AI Decision</TableHead>
                  <TableHead>AI Reasoning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.studentName}</TableCell>
                    <TableCell>{format(parseISO(req.submissionDate), 'PPpp')}</TableCell>
                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                    <TableCell>
                      {req.medicalNotesDataUri ? (
                        <a href={req.medicalNotesDataUri} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View Note <ExternalLink className="inline-block ml-1 h-3 w-3"/>
                        </a>
                      ) : (
                        'None'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={req.status === 'Approved' ? 'default' : req.status === 'Rejected' ? 'destructive' : 'secondary'}>
                        {req.status === 'Approved' && <CheckCircle className="inline-block mr-1 h-3 w-3"/>}
                        {req.status === 'Rejected' && <XCircle className="inline-block mr-1 h-3 w-3"/>}
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-xs">{req.aiReasoning || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">Leave applications are automatically processed by an AI based on school policy. Teachers can view the status here.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
