
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Users, User, Aperture } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Student, ClassData, User as AppUser } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';

interface DisplayStudent extends Student {
  className?: string;
  classDivision?: string;
}

export default function AdminIdCardPrintingPage() {
  const { toast } = useToast();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]); // For staff

  const [selectedUserType, setSelectedUserType] = useState<'student' | 'staff'>('student');
  const [selectedClassId, setSelectedClassId] = useState<string>('all'); // For student filtering
  const [selectedStudents, setSelectedStudents] = useState<Record<string, boolean>>({}); // studentId: isSelected
  const [selectedStaff, setSelectedStaff] = useState<Record<string, boolean>>({}); // staffId: isSelected
  const [previewCard, setPreviewCard] = useState<DisplayStudent | AppUser | null>(null);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setAllStudents(storedStudents ? JSON.parse(storedStudents) : []);

      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setAllClasses(storedClasses ? JSON.parse(storedClasses) : []);
      
      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      setAllUsers(storedUsers ? JSON.parse(storedUsers).filter((u: AppUser) => u.role === 'teacher' || u.role === 'admin') : []); // Example: filter for staff
    }
  }, []);
  
  const getClassDetails = (classId: string): Pick<ClassData, 'name' | 'division'> | null => {
    const cls = allClasses.find(c => c.id === classId);
    return cls ? { name: cls.name, division: cls.division } : null;
  };

  const displayStudents: DisplayStudent[] = useMemo(() => {
    return allStudents
      .filter(student => selectedClassId === 'all' || student.classId === selectedClassId)
      .map(student => {
        const classInfo = getClassDetails(student.classId);
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
  
  const handleStaffSelection = (staffId: string, checked: boolean) => {
    setSelectedStaff(prev => ({ ...prev, [staffId]: checked }));
  };

  const handleSelectAllStudents = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      displayStudents.forEach(s => newSelection[s.id] = true);
    }
    setSelectedStudents(newSelection);
  };

  const handleSelectAllStaff = (checked: boolean) => {
     const newSelection: Record<string, boolean> = {};
    if (checked) {
      allUsers.forEach(u => newSelection[u.id] = true);
    }
    setSelectedStaff(newSelection);
  }

  const handlePreviewCard = (user: DisplayStudent | AppUser) => {
    setPreviewCard(user);
  };
  
  const handlePrintSelected = () => {
    let itemsToPrint: any[] = [];
    let itemType = '';

    if (selectedUserType === 'student') {
      itemsToPrint = displayStudents.filter(s => selectedStudents[s.id]);
      itemType = 'student';
    } else { // staff
      itemsToPrint = allUsers.filter(u => selectedStaff[u.id]);
      itemType = 'staff';
    }

    if (itemsToPrint.length === 0) {
      toast({ title: "No Selection", description: `Please select ${itemType}(s) to print ID cards for.`, variant: "destructive" });
      return;
    }
    toast({ title: "Printing ID Cards (Mock)", description: `Generating ID cards for ${itemsToPrint.length} ${itemType}(s).` });
    console.log(`Printing ID cards for ${itemType}s:`, itemsToPrint.map(item => item.name));
  };
  
  const isStudent = (user: DisplayStudent | AppUser): user is DisplayStudent => {
    return 'classId' in user;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="ID Card Printing Administration" 
        description="Generate and print student and staff ID cards." 
      />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Select Users for ID Card</CardTitle>
                <Select value={selectedUserType} onValueChange={(val) => setSelectedUserType(val as 'student' | 'staff')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select User Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedUserType === 'student' && (
                <div className="mt-4">
                  <Label htmlFor="classFilter">Filter by Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
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
              )}
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto">
              {selectedUserType === 'student' && (
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
                        <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person student" />
                        <AvatarFallback>{student.name.substring(0,1)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer" onClick={() => handlePreviewCard(student)}>
                        {student.name} <span className="text-xs text-muted-foreground">({student.className} - {student.classDivision || 'N/A'})</span>
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(student)}>Preview</Button>
                    </div>
                  ))}
                  {displayStudents.length === 0 && <p className="text-muted-foreground text-center py-4">No students match filters.</p>}
                </>
              )}
              {selectedUserType === 'staff' && (
                 <>
                  {allUsers.length > 0 && (
                    <div className="mb-2 flex items-center space-x-2">
                       <Checkbox 
                        id="selectAllStaff" 
                        onCheckedChange={(checked) => handleSelectAllStaff(!!checked)}
                        checked={allUsers.length > 0 && allUsers.every(u => selectedStaff[u.id])}
                        />
                       <Label htmlFor="selectAllStaff">Select All Staff ({allUsers.filter(s => selectedStaff[s.id]).length} selected)</Label>
                    </div>
                  )}
                  {allUsers.map(staff => (
                    <div key={staff.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox 
                        id={`staff-${staff.id}`} 
                        checked={!!selectedStaff[staff.id]} 
                        onCheckedChange={(checked) => handleStaffSelection(staff.id, !!checked)}
                      />
                       <Avatar className="h-8 w-8">
                        {/* Assuming staff might not have profilePictureUrl structured same as students */}
                        <AvatarImage src={(staff as any).profilePictureUrl} alt={staff.name} data-ai-hint="person staff" /> 
                        <AvatarFallback>{staff.name.substring(0,1)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`staff-${staff.id}`} className="flex-grow cursor-pointer" onClick={() => handlePreviewCard(staff)}>
                        {staff.name} <span className="text-xs text-muted-foreground">({staff.role})</span>
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(staff)}>Preview</Button>
                    </div>
                  ))}
                  {allUsers.length === 0 && <p className="text-muted-foreground text-center py-4">No staff members found.</p>}
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handlePrintSelected}><Printer className="mr-2 h-4 w-4" /> Print Selected ID Cards</Button>
            </CardFooter>
          </Card>
        </div>
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>ID Card Preview</CardTitle>
              <CardDescription>This is a temporary mock-up.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center min-h-[250px]">
              {previewCard ? (
                <div className="w-80 h-48 bg-card border-2 border-primary rounded-lg shadow-xl flex flex-col p-4 relative text-foreground">
                  <div className="flex items-center mb-3">
                     <Aperture className="h-10 w-10 text-primary mr-3" />
                     <div>
                        <p className="text-sm font-bold uppercase text-primary">CampusHub School</p>
                        <p className="text-xs text-muted-foreground">Student/Staff Identification</p>
                     </div>
                  </div>
                  <div className="flex items-center">
                    <Avatar className="w-16 h-16 mr-3 border-2 border-primary">
                       <AvatarImage src={isStudent(previewCard) ? previewCard.profilePictureUrl : (previewCard as any).profilePictureUrl} alt={previewCard.name} data-ai-hint="person portrait" />
                       <AvatarFallback>{previewCard.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{previewCard.name}</p>
                      <p className="text-xs">ID: {previewCard.id}</p>
                      {isStudent(previewCard) ? (
                        <p className="text-xs">Class: {previewCard.className} - {previewCard.classDivision || 'N/A'}</p>
                      ) : (
                        <p className="text-xs">Role: {(previewCard as AppUser).role}</p>
                      )}
                      <p className="text-xs">Email: {previewCard.email}</p>
                    </div>
                  </div>
                   <p className="text-[0.6rem] text-muted-foreground absolute bottom-2 right-3">Academic Year: 2024-2025 (Mock)</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Select a user to preview their ID card.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
