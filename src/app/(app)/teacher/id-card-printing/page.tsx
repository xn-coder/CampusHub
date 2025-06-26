
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import type { ClassData, Student, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Printer, Aperture, Loader2, Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import jsPDF from 'jspdf';

interface DisplayStudent extends Student {
  className?: string;
  classDivision?: string;
}

export default function TeacherIdCardPrintingPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allStudentsInSchool, setAllStudentsInSchool] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({});
  const [previewCardStudent, setPreviewCardStudent] = useState<DisplayStudent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
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

  const studentsInSelectedClass: DisplayStudent[] = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassId);
    if (!selectedClassDetails) return [];

    return allStudentsInSchool
      .filter(s => s.class_id === selectedClassId)
      .map(student => ({
        ...student,
        className: selectedClassDetails.name,
        classDivision: selectedClassDetails.division,
      }));
  }, [selectedClassId, allStudentsInSchool, assignedClasses]);

  useEffect(() => {
    setSelectedStudents({});
    setPreviewCardStudent(null);
  }, [selectedClassId]);


  const handleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudents(prev => ({ ...prev, [studentId]: checked }));
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      studentsInSelectedClass.forEach(s => newSelection[s.id] = true);
    }
    setSelectedStudents(newSelection);
  };
  
  const handleDownloadPdf = async (studentsToPrint: DisplayStudent[]) => {
    if (studentsToPrint.length === 0) {
        toast({ title: "No Selection", description: "Please select student(s) to download ID cards for.", variant: "destructive" });
        return;
    }

    toast({ title: "Generating PDF...", description: `Preparing ID cards for ${studentsToPrint.length} student(s). Please wait.` });
    setIsPrinting(true);

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 54] // Standard credit card size
    });

    const toDataURL = (url: string): Promise<string> =>
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Network response was not ok, status: ${response.status}`);
                return response.blob();
            })
            .then(blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }));

    for (let i = 0; i < studentsToPrint.length; i++) {
        const student = studentsToPrint[i];
        if (i > 0) {
            doc.addPage();
        }

        doc.setDrawColor(49, 46, 129);
        doc.roundedRect(0.5, 0.5, 84.6, 53, 3, 3, 'S');
        doc.setFillColor(243, 244, 246);
        doc.rect(0.5, 0.5, 84.6, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.text("CampusHub School", 42.8, 8, { align: 'center' });

        const avatarUrl = student.profile_picture_url || `https://placehold.co/100x100.png?text=${student.name.substring(0,1)}`;
        try {
            const imgData = await toDataURL(avatarUrl);
            doc.addImage(imgData, 'PNG', 5, 15, 25, 25);
        } catch (e) {
            console.error("Could not add image for student", student.name, e);
            doc.setFillColor(230, 230, 230);
            doc.rect(5, 15, 25, 25, 'F');
            doc.setTextColor(100, 100, 100);
            doc.text(student.name.substring(0,1), 17.5, 27.5, { align: 'center' });
        }
        
        doc.setDrawColor(49, 46, 129);
        doc.rect(5, 15, 25, 25, 'S');
        doc.setTextColor(20, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(student.name, 35, 20, { maxWidth: 48 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Class: ${student.className || 'N/A'} - ${student.classDivision || 'N/A'}`, 35, 25);
        doc.text(`Guardian: ${student.guardian_name || 'N/A'}`, 35, 29);
        doc.text(`Contact: ${student.contact_number || 'N/A'}`, 35, 33);

        doc.setFillColor(49, 46, 129);
        doc.rect(0.5, 49.5, 84.6, 4, 'F');
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text('If found, please return to school office.', 42.8, 52, { align: 'center'});
    }

    doc.save(`ID_Cards_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsPrinting(false);
  };
  
  if (isLoading && !currentTeacherId) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading teacher data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
     return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Student ID Card Printing" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association.
        </CardContent></Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student ID Card Printing" 
        description="Generate and print ID cards for students in your classes." 
      />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Printer className="mr-2 h-5 w-5" /> Select Students</CardTitle>
              <CardDescription>Choose your class to view students and select them for ID card printing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="classSelect">Select Your Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || isPrinting}>
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

              {!isLoading && selectedClassId && studentsInSelectedClass.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No students found in {assignedClasses.find(c=>c.id === selectedClassId)?.name || 'this class'}.</p>
              )}

              {!isLoading && studentsInSelectedClass.length > 0 && (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                   <div className="mb-2 flex items-center space-x-2 p-2 border-b">
                       <Checkbox 
                        id="selectAllStudents" 
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        checked={studentsInSelectedClass.length > 0 && studentsInSelectedClass.every(s => selectedStudents[s.id])}
                        disabled={isLoading || isPrinting}
                        />
                       <Label htmlFor="selectAllStudents">Select All ({studentsInSelectedClass.filter(s => selectedStudents[s.id]).length} selected)</Label>
                    </div>
                  {studentsInSelectedClass.map(student => (
                    <div key={student.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox 
                        id={`student-${student.id}`} 
                        checked={!!selectedStudents[student.id]} 
                        onCheckedChange={(checked) => handleStudentSelection(student.id, !!checked)}
                        disabled={isLoading || isPrinting}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
                        <AvatarFallback>{student.name.substring(0,1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer" onClick={() => setPreviewCardStudent(student)}>
                        {student.name}
                      </Label>
                       <Button variant="ghost" size="sm" onClick={() => setPreviewCardStudent(student)} disabled={isLoading || isPrinting}>Preview</Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf([student])} disabled={isPrinting} title="Download ID Card">
                            <Download className="h-4 w-4" />
                       </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {!isLoading && studentsInSelectedClass.length > 0 && (
              <CardFooter>
                <Button onClick={() => handleDownloadPdf(studentsInSelectedClass.filter(s => selectedStudents[s.id]))} disabled={isLoading || isPrinting}>
                  {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} 
                  Download Selected
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
         <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>ID Card Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center items-center min-h-[250px]">
              {previewCardStudent ? (
                <div className="w-80 h-48 bg-card border-2 border-primary rounded-lg shadow-xl flex flex-col p-4 relative text-foreground">
                  <div className="flex items-center mb-3">
                     <Aperture className="h-10 w-10 text-primary mr-3" />
                     <div>
                        <p className="text-sm font-bold uppercase text-primary">CampusHub School</p>
                        <p className="text-xs text-muted-foreground">Student Identification</p>
                     </div>
                  </div>
                  <div className="flex items-center">
                    <Avatar className="w-16 h-16 mr-3 border-2 border-primary">
                       <AvatarImage src={previewCardStudent.profile_picture_url || undefined} alt={previewCardStudent.name} data-ai-hint="person portrait" />
                       <AvatarFallback>{previewCardStudent.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{previewCardStudent.name}</p>
                      <p className="text-xs">Class: {previewCardStudent.className} - {previewCardStudent.classDivision || 'N/A'}</p>
                      <p className="text-xs">Guardian: {previewCardStudent.guardian_name || 'N/A'}</p>
                    </div>
                  </div>
                   <p className="text-[0.6rem] text-muted-foreground absolute bottom-2 right-3">Academic Year: 2024-2025 (Mock)</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Select a student to preview their ID card.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
