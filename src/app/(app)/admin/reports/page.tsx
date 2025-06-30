
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Student, ClassData, Teacher } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowDownUp, BarChartHorizontalBig, Loader2, Users, Briefcase } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { getAdminSchoolIdForReports, getAdminReportsDataAction } from './actions';

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('student-activity');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof Student | keyof Teacher | ''>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (!adminUserId) {
        toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const schoolId = await getAdminSchoolIdForReports(adminUserId);
      setCurrentSchoolId(schoolId);

      if (schoolId) {
        const result = await getAdminReportsDataAction(schoolId);
        if (result.ok) {
          setAllStudents(result.students || []);
          setAllTeachers(result.teachers || []);
          setAllClasses(result.classes || []);
        } else {
          toast({ title: "Error loading report data", description: result.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, [toast]);

  const handleSort = (column: keyof Student | keyof Teacher | '') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };
  
  const formatDateSafe = (dateInput?: string | Date): string => {
    if (!dateInput) return 'N/A';
    const dateObj = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return isValid(dateObj) ? format(dateObj, 'PP') : 'N/A';
  };

  const genericMemoizedSort = (items: any[], itemSortBy: any, itemSortOrder: 'asc' | 'desc') => {
    if (itemSortBy) {
      items.sort((a, b) => {
        let valA = a[itemSortBy];
        let valB = b[itemSortBy];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return itemSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return itemSortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
      });
    }
    return items;
  }
  
  const filteredAndSortedStudents = useMemo(() => {
    let students = [...allStudents];
    if (searchTerm) {
      students = students.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (selectedClassFilter !== 'all') {
      students = students.filter(s => s.class_id === selectedClassFilter);
    }
    return genericMemoizedSort(students, sortBy, sortOrder);
  }, [allStudents, searchTerm, selectedClassFilter, sortBy, sortOrder]);

  const filteredAndSortedTeachers = useMemo(() => {
    let teachers = [...allTeachers];
    if (searchTerm) {
      teachers = teachers.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return genericMemoizedSort(teachers, sortBy, sortOrder);
  }, [allTeachers, searchTerm, sortBy, sortOrder]);


  const SortableHeader = ({ column, label, align = 'left' }: { column: keyof Student | keyof Teacher; label: string, align?: 'left' | 'right' }) => (
    <TableHead onClick={() => handleSort(column)} className={`cursor-pointer hover:bg-muted/50 text-${align}`}>
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortBy === column && <ArrowDownUp className="h-3 w-3" />}
      </div>
    </TableHead>
  );

  const StudentReportTab = () => (
    <>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by student name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
        <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {allClasses.map(cls => (
              <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filteredAndSortedStudents.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No student records found matching your criteria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="name" label="Student Name" />
              <SortableHeader column="email" label="Email" />
              <SortableHeader column="lastLogin" label="Last Login (Mock)" />
              <SortableHeader column="assignmentsSubmitted" label="Assignments Submitted (Mock)" align="right" />
              <SortableHeader column="attendancePercentage" label="Attendance % (Mock)" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.name}</TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell>{formatDateSafe(student.lastLogin)}</TableCell>
                <TableCell className="text-right">{student.assignmentsSubmitted ?? 'N/A'}</TableCell>
                <TableCell className="text-right">{student.attendancePercentage !== undefined && student.attendancePercentage !== null ? `${student.attendancePercentage}%` : 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
  
  const TeacherReportTab = () => (
    <>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by teacher name, email or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 w-full"
          />
        </div>
      </div>
       {filteredAndSortedTeachers.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No teacher records found matching your criteria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="name" label="Teacher Name" />
              <SortableHeader column="email" label="Email" />
              <SortableHeader column="subject" label="Primary Subject" />
              <SortableHeader column="lastLogin" label="Last Login (Mock)" />
              <SortableHeader column="assignmentsPosted" label="Assignments Posted (Mock)" align="right" />
              <SortableHeader column="classesTaught" label="Classes Taught" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTeachers.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium">{teacher.name}</TableCell>
                <TableCell>{teacher.email}</TableCell>
                <TableCell>{teacher.subject || 'N/A'}</TableCell>
                <TableCell>{formatDateSafe(teacher.lastLogin)}</TableCell>
                <TableCell className="text-right">{teacher.assignmentsPosted ?? 'N/A'}</TableCell>
                <TableCell className="text-right">{teacher.classesTaught ?? 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
       )}
    </>
  );


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading reports...</span></div>;
  }
  if (!currentSchoolId) {
    return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Activity Reports (Admin)" />
        <Card><CardContent className="pt-6 text-center text-destructive">Admin not associated with a school. Cannot view reports.</CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Activity Reports (Admin)" 
        description="View overall student and teacher activity. All activity data is currently illustrative mock data." 
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student-activity"><Users className="mr-2 h-4 w-4"/>Student Activity</TabsTrigger>
            <TabsTrigger value="teacher-activity"><Briefcase className="mr-2 h-4 w-4"/>Teacher Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="student-activity">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Student Activity Overview</CardTitle>
                    <CardDescription>Monitor student engagement across the school.</CardDescription>
                </CardHeader>
                <CardContent>{StudentReportTab()}</CardContent>
            </Card>
        </TabsContent>
         <TabsContent value="teacher-activity">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5" />Teacher Activity Overview</CardTitle>
                    <CardDescription>Monitor teacher engagement across the school.</CardDescription>
                </CardHeader>
                <CardContent>{TeacherReportTab()}</CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
