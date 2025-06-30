
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Table as TableIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherDataExportPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allStudentsInSchool, setAllStudentsInSchool] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const teacherUserId = localStorage.getItem('currentUserId');
      if (!teacherUserId) {
        toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
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
      setCurrentTeacherId(teacherProfile.id);
      setCurrentSchoolId(teacherProfile.school_id);

      if (teacherProfile.id && teacherProfile.school_id) {
        const [classesRes, studentsRes] = await Promise.all([
          supabase.from('classes').select('*').eq('teacher_id', teacherProfile.id).eq('school_id', teacherProfile.school_id),
          supabase.from('students').select('*').eq('school_id', teacherProfile.school_id)
        ]);

        if (classesRes.error) toast({ title: "Error fetching classes", variant: "destructive" });
        else setAssignedClasses(classesRes.data || []);

        if (studentsRes.error) toast({ title: "Error fetching students", variant: "destructive" });
        else setAllStudentsInSchool(studentsRes.data || []);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);

  const studentsToExport = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudentsInSchool.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudentsInSchool]);

  const handleDownloadCsv = () => {
    if (studentsToExport.length === 0) {
        toast({ title: "No Data", description: "There are no students in the selected class to download.", variant: "destructive" });
        return;
    }

    toast({ title: "Generating CSV...", description: `Preparing data for ${studentsToExport.length} student(s).` });
    
    const headers = ["Student ID", "Name", "Email", "Roll Number", "Class", "Guardian Name", "Contact Number", "Address", "Blood Group", "Date of Birth"];
    const csvRows = [
        headers.join(','),
        ...studentsToExport.map(student => {
            const className = assignedClasses.find(c => c.id === student.class_id)?.name || 'N/A';
            const row = [
                `"${student.id}"`,
                `"${student.name.replace(/"/g, '""')}"`,
                `"${(student.email || '').replace(/"/g, '""')}"`,
                `"${student.roll_number || ''}"`,
                `"${className}"`,
                `"${student.guardian_name || ''}"`,
                `"${student.contact_number || ''}"`,
                `"${(student.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                `"${student.blood_group || ''}"`,
                `"${student.date_of_birth || ''}"`,
            ];
            return row.join(',');
        })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_data_${selectedClassId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (isLoading && !currentTeacherId) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading teacher data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
     return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Student Data Export" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association.
        </CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Data Export" 
        description="Download detailed information for students in your classes as a CSV file." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><TableIcon className="mr-2 h-5 w-5" /> Export Student Data</CardTitle>
          <CardDescription>Choose one of your classes to view the student roster and download their information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="classSelect">Select Your Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading}>
              <SelectTrigger id="classSelect" className="max-w-md">
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {assignedClasses.length > 0 ? assignedClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                )) : <SelectItem value="-" disabled>No classes assigned to you</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {isLoading && selectedClassId && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading students...</div>}

          {!isLoading && selectedClassId && studentsToExport.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No students found in {assignedClasses.find(c=>c.id === selectedClassId)?.name || 'this class'}.</p>
          )}

          {!isLoading && studentsToExport.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roll Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsToExport.map(student => (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.roll_number || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {studentsToExport.length > 0 && (
          <CardFooter>
            <Button onClick={handleDownloadCsv} disabled={isLoading}>
              <Download className="mr-2 h-4 w-4" /> 
              Download Data for {studentsToExport.length} Student(s)
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
