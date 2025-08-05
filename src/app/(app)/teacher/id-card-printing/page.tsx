
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ClassData, Student } from '@/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { IdCardPreview } from '@/components/shared/id-card-preview';
import { Checkbox } from '@/components/ui/checkbox';
import { getTeacherClassesDataAction } from '../my-classes/actions'; // Use a reliable action
import { supabase } from '@/lib/supabaseClient';

export default function TeacherDataExportPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allStudentsInClasses, setAllStudentsInClasses] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolName, setCurrentSchoolName] = useState<string | null>(null);
  const [currentSchoolLogo, setCurrentSchoolLogo] = useState<string | null>(null);
  const [selectedStudentsForPrint, setSelectedStudentsForPrint] = useState<string[]>([]);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const result = await getTeacherClassesDataAction(teacherUserId);

    if (result.ok) {
      const classes = result.classesWithStudents || [];
      setAssignedClasses(classes);
      const allStudents = classes.flatMap(c => c.students);
      setAllStudentsInClasses(allStudents);

      if (classes.length > 0 && classes[0].school_id) {
         const { data: schoolDetails } = await supabase.from('schools').select('name, logo_url').eq('id', classes[0].school_id).single();
         setCurrentSchoolName(schoolDetails?.name || null);
         setCurrentSchoolLogo(schoolDetails?.logo_url || null);
      }

    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const studentsToDisplay = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudentsInClasses.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudentsInClasses]);

  const handleSelectStudentForPrint = (studentId: string, isSelected: boolean) => {
    setSelectedStudentsForPrint(prev => 
      isSelected ? [...prev, studentId] : prev.filter(id => id !== studentId)
    );
  };
  
  const handleSelectAllForPrint = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedStudentsForPrint(studentsToDisplay.map(s => s.id));
    } else {
      setSelectedStudentsForPrint([]);
    }
  };


  const handleDownloadCsv = () => {
    if (studentsToDisplay.length === 0) {
        toast({ title: "No Data", description: "There are no students in the selected class to download.", variant: "destructive" });
        return;
    }

    toast({ title: "Generating CSV...", description: `Preparing data for ${studentsToDisplay.length} student(s).` });
    
    const headers = ["Student ID", "Name", "Email", "Roll Number", "Class", "School Name", "Guardian Name", "Contact Number", "Address", "Blood Group", "Date of Birth", "Admission Date"];
    const csvRows = [
        headers.join(','),
        ...studentsToDisplay.map(student => {
            const className = assignedClasses.find(c => c.id === student.class_id)?.name || 'N/A';
            const dob = student.date_of_birth ? format(parseISO(student.date_of_birth), 'yyyy-MM-dd') : '';
            const admissionDate = student.admission_date ? format(parseISO(student.admission_date), 'yyyy-MM-dd') : '';
            
            const row = [
                `"${student.id}"`,
                `"${student.name.replace(/"/g, '""')}"`,
                `"${(student.email || '').replace(/"/g, '""')}"`,
                `"${student.roll_number || ''}"`,
                `"${className}"`,
                `"${(currentSchoolName || 'N/A').replace(/"/g, '""')}"`,
                `"${(student.guardian_name || '').replace(/"/g, '""')}"`,
                `"${student.contact_number || ''}"`,
                `"${(student.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
                `"${student.blood_group || ''}"`,
                `"${dob}"`,
                `"${admissionDate}"`,
            ];
            return row.join(',');
        })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_id_card_data_${selectedClassId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (selectedStudentsForPrint.length === 0) {
      toast({title: "No Cards Selected", description: "Please select one or more ID cards to print.", variant: "destructive"});
      return;
    }
    window.print();
  };
  
  const getStudentClassName = (student: Student) => {
    if (!student.class_id) return "N/A";
    const cls = assignedClasses.find(c => c.id === student.class_id);
    return cls ? `${cls.name} - ${cls.division}` : 'Unknown Class';
  };
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading teacher data...</span></div>;
  }
  if (!assignedClasses) {
     return (
        <div className="flex flex-col gap-6">
        <PageHeader title="ID Card Printing" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association.
        </CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="ID Card Printing" 
        description="Preview, select, and print student ID cards for your assigned classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">ID Card Generation</CardTitle>
          <CardDescription>Choose one of your classes to view the student roster, then select cards to print.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-end print:hidden">
            <div className="flex-grow">
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
            <div className="flex gap-2">
              <Button onClick={handleDownloadCsv} disabled={studentsToDisplay.length === 0} variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
              <Button onClick={handlePrint} disabled={selectedStudentsForPrint.length === 0}>
                  <Printer className="mr-2 h-4 w-4" /> Print Selected ({selectedStudentsForPrint.length})
              </Button>
            </div>
          </div>
          
           {selectedClassId && studentsToDisplay.length > 0 && (
                <div className="flex items-center space-x-2 mb-4 print:hidden">
                    <Checkbox
                      id="select-all"
                      onCheckedChange={(checked) => handleSelectAllForPrint(Boolean(checked))}
                      checked={selectedStudentsForPrint.length === studentsToDisplay.length && studentsToDisplay.length > 0}
                    />
                    <Label htmlFor="select-all">Select All Visible Cards</Label>
                </div>
            )}
               
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 printable-area">
                {isLoading && selectedClassId ? (
                    <div className="col-span-full text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/> Loading students...</div>
                ) : studentsToDisplay.length > 0 ? (
                    studentsToDisplay.map(student => (
                        <div key={student.id} className={`relative print-card ${!selectedStudentsForPrint.includes(student.id) ? 'print:hidden' : ''}`}>
                            <Checkbox
                                className="absolute top-2 right-2 z-10 print:hidden"
                                checked={selectedStudentsForPrint.includes(student.id)}
                                onCheckedChange={(checked) => handleSelectStudentForPrint(student.id, Boolean(checked))}
                            />
                            <IdCardPreview student={student} schoolName={currentSchoolName} className={getStudentClassName(student)} schoolLogoUrl={currentSchoolLogo} />
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-center py-4 col-span-full">
                       {selectedClassId ? 'No students found in this class.' : 'Please select a class to view ID cards.'}
                    </p>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
