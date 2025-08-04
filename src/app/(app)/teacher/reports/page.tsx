
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Student, ClassData } from '@/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowDownUp, BarChartHorizontalBig, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getTeacherStudentsAndClassesAction } from './actions';
import { format, parseISO, isValid } from 'date-fns';

type StudentWithActivity = Student & {
    lastLogin?: string;
    assignmentsSubmitted?: number;
    attendancePercentage?: number;
};

export default function TeacherReportsPage() {
  const { toast } = useToast();
  const [teacherStudents, setTeacherStudents] = useState<StudentWithActivity[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof StudentWithActivity | ''>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher user not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const { data: teacherProfile, error: profileError } = await supabase
      .from('teachers')
      .select('id, school_id')
      .eq('user_id', teacherUserId)
      .single();

    if (profileError || !teacherProfile) {
      toast({ title: "Error", description: "Could not load teacher profile.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    
    if (teacherProfile.id && teacherProfile.school_id) {
      const result = await getTeacherStudentsAndClassesAction(teacherProfile.id, teacherProfile.school_id);
      if (result.ok) {
        setTeacherStudents(result.students as StudentWithActivity[] || []);
        setTeacherClasses(result.classes || []);
      } else {
        toast({ title: "Error loading report data", description: result.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Error", description: "Teacher profile or school ID missing.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (column: keyof StudentWithActivity | '') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getClassDisplayName = (classId?: string | null): string => {
    if (!classId) return 'N/A';
    const classInfo = teacherClasses.find(c => c.id === classId);
    return classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';
  };
  
  const formatDateSafe = (dateInput?: string | Date): string => {
    if (!dateInput) return 'N/A';
    const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return isValid(dateObj) ? format(dateObj, 'PP') : 'N/A';
  };

  const filteredAndSortedStudents = useMemo(() => {
    let students = [...teacherStudents];
    if (searchTerm) {
      students = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (selectedClassFilter !== 'all') {
      students = students.filter(s => s.class_id === selectedClassFilter);
    }
    if (sortBy) {
        students.sort((a, b) => {
            let valA = a[sortBy as keyof StudentWithActivity];
            let valB = b[sortBy as keyof StudentWithActivity];
            
            if (valA === undefined || valA === null) valA = sortOrder === 'asc' ? Number.MAX_SAFE_INTEGER as any : Number.MIN_SAFE_INTEGER as any;
            if (valB === undefined || valB === null) valB = sortOrder === 'asc' ? Number.MAX_SAFE_INTEGER as any : Number.MIN_SAFE_INTEGER as any;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            }
            if(sortBy === 'lastLogin') {
                const dateA = valA ? new Date(valA).getTime() : 0;
                const dateB = valB ? new Date(valB).getTime() : 0;
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
    }
    return students;
  }, [teacherStudents, searchTerm, selectedClassFilter, sortBy, sortOrder]);

  const SortableHeader = ({ column, label, align = 'left' }: { column: keyof StudentWithActivity; label: string, align?: 'left' | 'right' }) => (
    <TableHead onClick={() => handleSort(column)} className={`cursor-pointer hover:bg-muted/50 text-${align}`}>
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortBy === column && <ArrowDownUp className="h-3 w-3" />}
      </div>
    </TableHead>
  );
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading reports...</span></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Activity Reports" 
        description="View student information and activity for your assigned classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5" />Student Roster & Activity</CardTitle>
          <CardDescription>An overview of students you teach.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search your students by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={teacherClasses.length === 0}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Classes</SelectItem>
                {teacherClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {teacherClasses.length === 0 && (
             <p className="text-muted-foreground text-center py-4">You are not assigned to any classes. Reports will be available once you are assigned.</p>
          )}

          {teacherClasses.length > 0 && filteredAndSortedStudents.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No student records found matching your criteria in your classes.</p>
          )}
          
          {teacherClasses.length > 0 && filteredAndSortedStudents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name" label="Student Name" />
                  <SortableHeader column="email" label="Email" />
                  <SortableHeader column="class_id" label="Class" />
                  <SortableHeader column="lastLogin" label="Last Login" />
                  <SortableHeader column="assignmentsSubmitted" label="Assignments Submitted" align="right" />
                  <SortableHeader column="attendancePercentage" label="Attendance %" align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{getClassDisplayName(student.class_id)}</TableCell>
                    <TableCell>{formatDateSafe(student.lastLogin)}</TableCell>
                    <TableCell className="text-right">{student.assignmentsSubmitted ?? 'N/A'}</TableCell>
                    <TableCell className="text-right">{student.attendancePercentage !== undefined && student.attendancePercentage !== null ? `${student.attendancePercentage}%` : 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
