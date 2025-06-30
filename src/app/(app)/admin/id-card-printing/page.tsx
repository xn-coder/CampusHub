
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Student, ClassData } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Table as TableIcon } from 'lucide-react';
import { getStudentDataExportPageDataAction } from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export default function AdminStudentDataExportPage() {
  const { toast } = useToast();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string|null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState<string>('all'); 


  useEffect(() => {
    async function loadData() {
      setIsLoadingPage(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (!adminUserId) {
        toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
        setIsLoadingPage(false);
        return;
      }

      const result = await getStudentDataExportPageDataAction(adminUserId);
      if (result.ok) {
        setCurrentSchoolId(result.schoolId || null);
        setAllStudents(result.students || []);
        setAllClasses(result.classes || []);
      } else {
        toast({ title: "Error loading data", description: result.message, variant: "destructive" });
        setCurrentSchoolId(null);
        setAllStudents([]);
        setAllClasses([]);
      }
      setIsLoadingPage(false);
    }
    loadData();
  }, [toast]);
  

  const studentsToExport = useMemo(() => {
    return allStudents
      .filter(student => selectedClassId === 'all' || student.class_id === selectedClassId)
  }, [allStudents, selectedClassId]);

  
  const handleDownloadCsv = () => {
    if (studentsToExport.length === 0) {
        toast({ title: "No Data", description: "There are no students to download for the current selection.", variant: "destructive" });
        return;
    }
    
    toast({ title: "Generating CSV...", description: `Preparing data for ${studentsToExport.length} student(s).` });
    
    const headers = ["Student ID", "Name", "Email", "Roll Number", "Class", "Guardian Name", "Contact Number", "Address", "Blood Group", "Date of Birth"];
    const csvRows = [
        headers.join(','),
        ...studentsToExport.map(student => {
            const className = allClasses.find(c => c.id === student.class_id)?.name || 'N/A';
            const row = [
                `"${student.id}"`,
                `"${student.name.replace(/"/g, '""')}"`,
                `"${(student.email || '').replace(/"/g, '""')}"`,
                `"${student.roll_number || ''}"`,
                `"${className}"`,
                `"${student.guardian_name || ''}"`,
                `"${student.contact_number || ''}"`,
                `"${(student.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Remove newlines
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
    link.setAttribute("download", `student_data_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoadingPage) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Student Data Export" />
            <Card>
                <CardContent className="pt-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin inline-block mr-2"/> Loading page data...
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!currentSchoolId && !isLoadingPage) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Student Data Export" />
        <Card>
            <CardContent className="pt-6 text-center text-destructive">
                Admin not associated with a school or school data could not be loaded.
            </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Data Export" 
        description="Download detailed student information in a tabular format (CSV)." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Export Student Information</CardTitle>
          <CardDescription>Select a class to filter the students, or download data for all students in the school.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4">
                <Label htmlFor="classFilter">Filter by Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingPage}>
                  <SelectTrigger id="classFilter" className="max-w-md">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes ({allStudents.length} students)</SelectItem>
                    {allClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division} ({allStudents.filter(s => s.class_id === cls.id).length} students)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
               {studentsToExport.length > 0 ? (
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
               ) : (
                <p className="text-muted-foreground text-center py-4">No students to display for the selected class.</p>
               )}
        </CardContent>
        <CardFooter>
            <Button onClick={handleDownloadCsv} disabled={studentsToExport.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Download ({studentsToExport.length}) Student Records
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
