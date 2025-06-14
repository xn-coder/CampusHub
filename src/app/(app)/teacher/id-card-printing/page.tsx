
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import type { ClassData, Student } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Printer, Aperture } from 'lucide-react';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';

interface DisplayStudent extends Student {
  className?: string;
  classDivision?: string;
}

export default function TeacherIdCardPrintingPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]); // Store all students once
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({}); // studentId: isSelected
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [previewCardStudent, setPreviewCardStudent] = useState<DisplayStudent | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const allClasses: ClassData[] = storedActiveClasses ? JSON.parse(storedActiveClasses) : [];
      const teacherClasses = teacherId ? allClasses.filter(cls => cls.teacherId === teacherId) : [];
      setAssignedClasses(teacherClasses);
      
      const storedStudentsData = localStorage.getItem(MOCK_STUDENTS_KEY);
      setAllStudents(storedStudentsData ? JSON.parse(storedStudentsData) : []);
    }
  }, []);

  const studentsInSelectedClass: DisplayStudent[] = useMemo(() => {
    if (!selectedClassSectionId) return [];
    const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassSectionId);
    if (!selectedClassDetails) return [];

    return allStudents
      .filter(s => s.classId === selectedClassSectionId)
      .map(student => ({
        ...student,
        className: selectedClassDetails.name,
        classDivision: selectedClassDetails.division,
      }));
  }, [selectedClassSectionId, allStudents, assignedClasses]);

  useEffect(() => {
    setSelectedStudents({}); // Reset selection when class changes
    setPreviewCardStudent(null);
  }, [selectedClassSectionId]);


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

  const handlePrintSelectedCards = () => {
    const studentsToPrint = studentsInSelectedClass.filter(s => selectedStudents[s.id]);
    if (studentsToPrint.length === 0) {
      toast({ title: "No Students Selected", description: "Please select students to print ID cards for.", variant: "destructive" });
      return;
    }
    toast({ title: "Printing ID Cards (Mock)", description: `Generating ID cards for ${studentsToPrint.length} student(s).` });
    console.log("Printing ID cards for:", studentsToPrint.map(s => s.name));
  };
  
  const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassSectionId);

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
                <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
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

              {selectedClassSectionId && studentsInSelectedClass.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No students found in {selectedClassDetails?.name} - {selectedClassDetails?.division}.</p>
              )}

              {studentsInSelectedClass.length > 0 && (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                   <div className="mb-2 flex items-center space-x-2 p-2 border-b">
                       <Checkbox 
                        id="selectAllStudents" 
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        checked={studentsInSelectedClass.length > 0 && studentsInSelectedClass.every(s => selectedStudents[s.id])}
                        />
                       <Label htmlFor="selectAllStudents">Select All ({studentsInSelectedClass.filter(s => selectedStudents[s.id]).length} selected)</Label>
                    </div>
                  {studentsInSelectedClass.map(student => (
                    <div key={student.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox 
                        id={`student-${student.id}`} 
                        checked={!!selectedStudents[student.id]} 
                        onCheckedChange={(checked) => handleStudentSelection(student.id, !!checked)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person student" />
                        <AvatarFallback>{student.name.substring(0,1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer" onClick={() => setPreviewCardStudent(student)}>
                        {student.name}
                      </Label>
                       <Button variant="ghost" size="sm" onClick={() => setPreviewCardStudent(student)}>Preview</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {studentsInSelectedClass.length > 0 && (
              <CardFooter>
                <Button onClick={handlePrintSelectedCards}><Printer className="mr-2 h-4 w-4" /> Print Selected ID Cards</Button>
              </CardFooter>
            )}
          </Card>
        </div>
         <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>ID Card Preview</CardTitle>
              <CardDescription>This is a temporary mock-up.</CardDescription>
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
                       <AvatarImage src={previewCardStudent.profilePictureUrl} alt={previewCardStudent.name} data-ai-hint="person portrait" />
                       <AvatarFallback>{previewCardStudent.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{previewCardStudent.name}</p>
                      <p className="text-xs">ID: {previewCardStudent.id}</p>
                      <p className="text-xs">Class: {previewCardStudent.className} - {previewCardStudent.classDivision || 'N/A'}</p>
                      <p className="text-xs">Email: {previewCardStudent.email}</p>
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
