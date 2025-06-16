
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Users, User, Aperture, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Student, ClassData, AppUser, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getIdCardPageDataAction } from './actions';


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
  
  const handlePrintSelected = () => {
    let itemsToPrint: any[] = [];
    let itemType = '';

    if (selectedUserType === 'student') {
      itemsToPrint = displayStudents.filter(s => selectedStudents[s.id]);
      itemType = 'student';
    }
    // Staff logic removed

    if (itemsToPrint.length === 0) {
      toast({ title: "No Selection", description: `Please select ${itemType}(s) to print ID cards for.`, variant: "destructive" });
      return;
    }
    toast({ title: "Printing ID Cards (Mock)", description: `Generating ID cards for ${itemsToPrint.length} ${itemType}(s).` });
    console.log(`Printing ID cards for ${itemType}s:`, itemsToPrint.map(item => item.name));
  };
  
  const isStudent = (user: DisplayStudent | AppUser | null): user is DisplayStudent => {
    return user !== null && 'class_id' in user; // Using class_id to differentiate
  }

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
                {/* User type selection removed as 'staff' is gone */}
              </div>
              {selectedUserType === 'student' && (
                <div className="mt-4">
                  <Label htmlFor="classFilter">Filter by Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingPage}>
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
                        <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
                        <AvatarFallback>{student.name.substring(0,1)}</AvatarFallback>
                      </Avatar>
                      <Label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer" onClick={() => handlePreviewCard(student)}>
                        {student.name} <span className="text-xs text-muted-foreground">({student.className} - {student.classDivision || 'N/A'})</span>
                      </Label>
                      <Button variant="ghost" size="sm" onClick={() => handlePreviewCard(student)}>Preview</Button>
                    </div>
                  ))}
                  {displayStudents.length === 0 && <p className="text-muted-foreground text-center py-4">No students match filters for this school.</p>}
                </>
              )}
             {/* Staff selection UI removed */}
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
              {previewCard && isStudent(previewCard) ? (
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
                       <AvatarImage src={(previewCard as DisplayStudent).profile_picture_url || undefined} alt={previewCard.name} data-ai-hint="person portrait" />
                       <AvatarFallback>{previewCard.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{previewCard.name}</p>
                      <p className="text-xs">ID: {previewCard.id}</p>
                      <p className="text-xs">Class: {(previewCard as DisplayStudent).className} - {(previewCard as DisplayStudent).classDivision || 'N/A'}</p>
                      <p className="text-xs">Email: {previewCard.email}</p>
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
