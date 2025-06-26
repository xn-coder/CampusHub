
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Users, User, Aperture, Loader2, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Student, ClassData, AppUser, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getIdCardPageDataAction } from './actions';
import jsPDF from 'jspdf';


interface DisplayStudent extends Student {
  className?: string;
  classDivision?: string;
}

export default function AdminIdCardPrintingPage() {
  const { toast } = useToast();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string|null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);


  const [selectedUserType, setSelectedUserType] = useState<'student'>('student'); // Staff removed
  const [selectedClassId, setSelectedClassId] = useState<string>('all'); 
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({}); 
  const [previewCard, setPreviewCard] = useState<DisplayStudent | null>(null); // Only student preview


  useEffect(() => {
    async function loadData() {
      setIsLoadingPage(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (!adminUserId) {
        toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
        setIsLoadingPage(false);
        return;
      }

      const result = await getIdCardPageDataAction(adminUserId);
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
  
  const getClassDetails = (classId: string): Pick<ClassData, 'name' | 'division'> | null => {
    const cls = allClasses.find(c => c.id === classId);
    return cls ? { name: cls.name, division: cls.division } : null;
  };

  const displayStudents: DisplayStudent[] = useMemo(() => {
    return allStudents
      .filter(student => selectedClassId === 'all' || student.class_id === selectedClassId)
      .map(student => {
        const classInfo = student.class_id ? getClassDetails(student.class_id) : null;
        return {
          ...student,
          className: classInfo?.name,
          classDivision: classInfo?.division,
        };
      });
  }, [allStudents, selectedClassId, allClasses]);

  const handleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudents(prev => ({ ...prev, [studentId]: checked }));
  };
  
  const handleSelectAllStudents = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      displayStudents.forEach(s => newSelection[s.id] = true);
    }
    setSelectedStudents(newSelection);
  };

  const handlePreviewCard = (user: DisplayStudent) => {
    setPreviewCard(user);
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
        doc.text(`ID: ${student.id}`, 35, 25);
        doc.text(`Class: ${student.className || 'N/A'} - ${student.classDivision || 'N/A'}`, 35, 29);
        doc.text(`Guardian: ${student.guardian_name || 'N/A'}`, 35, 33);
        doc.text(`Contact: ${student.contact_number || 'N/A'}`, 35, 37);

        doc.setFillColor(49, 46, 129);
        doc.rect(0.5, 49.5, 84.6, 4, 'F');
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text('If found, please return to school office.', 42.8, 52, { align: 'center'});
    }

    doc.save(`ID_Cards_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsPrinting(false);
  };

  if (isLoadingPage) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="ID Card Printing Administration" />
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
        <PageHeader title="ID Card Printing Administration" />
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
        title="ID Card Printing Administration" 
        description="Generate and print student ID cards." 
      />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Select Users for ID Card</CardTitle>
              </div>
              <div className="mt-4">
                <Label htmlFor="classFilter">Filter by Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingPage || isPrinting}>
                  <SelectTrigger id="classFilter">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {allClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto">
                <>
                  {displayStudents.length > 0 && (
                    <div className="mb-2 flex items-center space-x-2">
                       <Checkbox 
                        id="selectAllStudents" 
                        onCheckedChange={(checked) => handleSelectAllStudents(!!checked)}
                        checked={displayStudents.length > 0 && displayStudents.every(s => selectedStudents[s.id])}
                        />
                       <Label htmlFor="selectAllStudents">Select All Students ({displayStudents.filter(s => selectedStudents[s.id]).length} selected)</Label>
                    </div>
                  )}
                  {displayStudents.map(student => (
                    <div key={student.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox 
                        id={`student-${student.id}`} 
                        checked={!!selectedStudents[student.id]} 
                        onCheckedChange={(checked) => handleStudentSelection(student.id, !!checked)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
                        <AvatarFallback>{student.name.substring(0,1)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer" onClick={() => handlePreviewCard(student)}>
                        {student.name} <span className="text-xs text-muted-foreground">({student.className} - {student.classDivision || 'N/A'})</span>
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(student)}>Preview</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf([student])} disabled={isPrinting} title="Download ID Card">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {displayStudents.length === 0 && <p className="text-muted-foreground text-center py-4">No students match filters for this school.</p>}
                </>
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleDownloadPdf(displayStudents.filter(s => selectedStudents[s.id]))} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} 
                Download Selected
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>ID Card Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center items-center min-h-[250px]">
              {previewCard ? (
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
                       <AvatarImage src={previewCard.profile_picture_url || undefined} alt={previewCard.name} data-ai-hint="person portrait" />
                       <AvatarFallback>{previewCard.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{previewCard.name}</p>
                      <p className="text-xs">ID: {previewCard.id}</p>
                      <p className="text-xs">Class: {previewCard.className} - {previewCard.classDivision || 'N/A'}</p>
                      <p className="text-xs">Guardian: {previewCard.guardian_name || 'N/A'}</p>
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
