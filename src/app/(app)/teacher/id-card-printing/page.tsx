
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import type { ClassData, Student } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Printer, Users, CheckSquare } from 'lucide-react';

const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';

export default function TeacherIdCardPrintingPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>('');
  const [studentsInSelectedClass, setStudentsInSelectedClass] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({}); // studentId: isSelected

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('currentUserId');
      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      
      if (userId && storedActiveClasses) {
        const allClasses: ClassData[] = JSON.parse(storedActiveClasses);
        const teacherClasses = allClasses.filter(cls => cls.teacherId === userId);
        setAssignedClasses(teacherClasses);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedClassSectionId && typeof window !== 'undefined') {
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      if (storedStudents) {
        const allStudents: Student[] = JSON.parse(storedStudents);
        const classStudents = allStudents.filter(s => s.classId === selectedClassSectionId);
        setStudentsInSelectedClass(classStudents);
        setSelectedStudents({}); // Reset selection when class changes
      } else {
        setStudentsInSelectedClass([]);
        setSelectedStudents({});
      }
    } else {
      setStudentsInSelectedClass([]);
      setSelectedStudents({});
    }
  }, [selectedClassSectionId]);

  const handleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handlePrintSelectedCards = () => {
    const studentsToPrint = studentsInSelectedClass.filter(s => selectedStudents[s.id]);
    if (studentsToPrint.length === 0) {
      toast({ title: "No Students Selected", description: "Please select students to print ID cards for.", variant: "destructive" });
      return;
    }
    // Mock printing
    toast({ title: "Printing ID Cards (Mock)", description: `Generating ID cards for ${studentsToPrint.length} student(s).` });
    console.log("Printing ID cards for:", studentsToPrint.map(s => s.name));
    // In a real app, you'd trigger a print dialog or generate PDFs.
  };
  
  const selectedClassDetails = assignedClasses.find(c => c.id === selectedClassSectionId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="ID Card Printing" 
        description="Generate and print ID cards for students in your classes." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Printer className="mr-2 h-5 w-5" /> Student ID Cards</CardTitle>
          <CardDescription>Select your class to view students and print their ID cards.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="classSelect">Select Class</Label>
            <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId}>
              <SelectTrigger id="classSelect" className="max-w-md">
                <SelectValue placeholder="Choose your class" />
              </SelectTrigger>
              <SelectContent>
                {assignedClasses.length > 0 ? assignedClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                )) : <SelectItem value="-" disabled>No classes assigned to you</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {studentsInSelectedClass.length === 0 && selectedClassSectionId && (
            <p className="text-muted-foreground text-center py-4">No students found in {selectedClassDetails?.name} - {selectedClassDetails?.division}.</p>
          )}

          {studentsInSelectedClass.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    <TableHead>Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInSelectedClass.map(student => (
                    <TableRow key={student.id} 
                              onClick={() => handleStudentSelection(student.id)} 
                              className="cursor-pointer hover:bg-muted/50"
                              data-state={selectedStudents[student.id] ? 'selected' : ''}
                    >
                      <TableCell className="text-center">
                        <Button 
                          variant={selectedStudents[student.id] ? "default" : "outline"} 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleStudentSelection(student.id); }}
                        >
                           {selectedStudents[student.id] ? <CheckSquare className="h-4 w-4"/> : <div className="h-4 w-4 border rounded-sm"/> }
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person student" />
                          <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
  );
}
