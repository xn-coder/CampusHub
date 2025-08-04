"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Student, ClassData, SchoolDetails } from '@/types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Printer } from 'lucide-react';
import { getStudentDataExportPageDataAction } from './actions';
import { format, parseISO } from 'date-fns';
import { IdCardPreview } from '@/components/shared/id-card-preview';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabaseClient';

export default function AdminIdCardPrintingPage() {
  const { toast } = useToast();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string|null>(null);
  const [currentSchoolName, setCurrentSchoolName] = useState<string|null>(null);
  const [currentSchoolLogo, setCurrentSchoolLogo] = useState<string|null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState<string>('all'); 
  const [selectedStudentsForPrint, setSelectedStudentsForPrint] = useState<string[]>([]);

  const loadPageData = useCallback(async () => {
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
      setCurrentSchoolName(result.schoolName || null);
      setAllStudents(result.students || []);
      setAllClasses(result.classes || []);
      
      // To get the logo, we fetch the full school details if an ID is present
      if (result.schoolId) {
        const { data: schoolDetails } = await supabase.from('schools').select('logo_url').eq('id', result.schoolId).single();
        setCurrentSchoolLogo(schoolDetails?.logo_url || null);
      }

    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
      setAllStudents([]);
      setAllClasses([]);
    }
    setIsLoadingPage(false);
  }, [toast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);
  

  const studentsToDisplay = useMemo(() => {
    return allStudents
      .filter(student => selectedClassId === 'all' || student.class_id === selectedClassId)
  }, [allStudents, selectedClassId]);

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
        toast({ title: "No Data", description: "There are no students to download for the current selection.", variant: "destructive" });
        return;
    }
    
    toast({ title: "Generating CSV...", description: `Preparing data for ${studentsToDisplay.length} student(s).` });
    
    const headers = ["Student ID", "Name", "Email", "Roll Number", "Class", "School Name", "Guardian Name", "Contact Number", "Address", "Blood Group", "Date of Birth", "Admission Date"];
    const csvRows = [
        headers.join(','),
        ...studentsToDisplay.map(student => {
            const className = allClasses.find(c => c.id === student.class_id)?.name || 'N/A';
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
    link.setAttribute("download", `student_id_card_data_${new Date().toISOString().split('T')[0]}.csv`);
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
    const cls = allClasses.find(c => c.id === student.class_id);
    return cls ? `${cls.name} - ${cls.division}` : 'Unknown Class';
  };

  if (isLoadingPage) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="ID Card Printing" />
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
        <PageHeader title="ID Card Printing" />
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
        title="ID Card Printing" 
        description="Preview, select, and print student ID cards. You can also download the data as a CSV for external use." 
      />
      <Card>
        <CardHeader>
          <CardTitle>ID Card Generation</CardTitle>
          <CardDescription>Select a class to filter the students, then select the cards you wish to print.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-end print:hidden">
                <div className="flex-grow">
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
                <div className="flex gap-2">
                    <Button onClick={handleDownloadCsv} disabled={studentsToDisplay.length === 0} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Download CSV
                    </Button>
                    <Button onClick={handlePrint} disabled={selectedStudentsForPrint.length === 0}>
                        <Printer className="mr-2 h-4 w-4" /> Print Selected ({selectedStudentsForPrint.length})
                    </Button>
                </div>
            </div>

            {studentsToDisplay.length > 0 && (
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
                {studentsToDisplay.length > 0 ? (
                    studentsToDisplay.map(student => (
                        <div key={student.id} className={`relative print-card ${!selectedStudentsForPrint.includes(student.id) ? 'print:hidden' : ''}`}>
                            <Checkbox
                                className="absolute top-2 right-2 z-10 print:hidden"
                                checked={selectedStudentsForPrint.includes(student.id)}
                                onCheckedChange={(checked) => handleSelectStudentForPrint(student.id, Boolean(checked))}
                            />
                            <IdCardPreview student={student} schoolName={currentSchoolName} className={getStudentClassName(student)} schoolLogoUrl={currentSchoolLogo}/>
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-center py-4 col-span-full">
                        {isLoadingPage ? 'Loading students...' : 'No students to display for the selected class.'}
                    </p>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
