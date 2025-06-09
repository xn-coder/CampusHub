
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdmissionRecord, Student, User, ClassData, ClassNameRecord, SectionRecord } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FilePlus, UserPlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MOCK_ADMISSIONS_KEY = 'mockAdmissionsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_CLASSES_KEY = 'mockClassesData'; 
const MOCK_CLASS_NAMES_KEY = 'mockClassNamesData';
const MOCK_SECTION_NAMES_KEY = 'mockSectionNamesData';


export default function TeacherRegisterStudentPage() {
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');

  const [allClassNames, setAllClassNames] = useState<ClassNameRecord[]>([]);
  const [allSectionNames, setAllSectionNames] = useState<SectionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);

  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(MOCK_ADMISSIONS_KEY)) localStorage.setItem(MOCK_ADMISSIONS_KEY, JSON.stringify([]));
      if (!localStorage.getItem(MOCK_STUDENTS_KEY)) localStorage.setItem(MOCK_STUDENTS_KEY, JSON.stringify([]));
      if (!localStorage.getItem(MOCK_USER_DB_KEY)) localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify([]));
      
      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      if (storedActiveClasses) setActiveClasses(JSON.parse(storedActiveClasses));
      else localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify([]));

      const storedClassNames = localStorage.getItem(MOCK_CLASS_NAMES_KEY);
      if (storedClassNames) setAllClassNames(JSON.parse(storedClassNames));
      else localStorage.setItem(MOCK_CLASS_NAMES_KEY, JSON.stringify([]));

      const storedSectionNames = localStorage.getItem(MOCK_SECTION_NAMES_KEY);
      if (storedSectionNames) setAllSectionNames(JSON.parse(storedSectionNames));
      else localStorage.setItem(MOCK_SECTION_NAMES_KEY, JSON.stringify([]));
    }
  }, []);

  const updateLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const handleClassNameChange = (value: string) => {
    setSelectedClassName(value);
    setSelectedDivision(''); 
    setSelectedClassId(''); 
  };

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    const foundActiveClass = activeClasses.find(
      (cls) => cls.name === selectedClassName && cls.division === value
    );
    if (foundActiveClass) {
      setSelectedClassId(foundActiveClass.id);
    } else {
      setSelectedClassId('');
      if (selectedClassName && value) { 
        toast({
          title: "Combination Not Active",
          description: `The class-section '${selectedClassName} - ${value}' is not activated. Please ask an Admin to activate it in Class Management.`,
          variant: "destructive",
          duration: 7000,
        });
      }
    }
  };

  const handleSubmitAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !dateOfBirth || !guardianName || !contactNumber || !address) {
      toast({ title: "Error", description: "All student details are required.", variant: "destructive" });
      return;
    }
    if (!selectedClassName || !selectedDivision) {
        toast({ title: "Error", description: "Please select a class and a section for the student.", variant: "destructive" });
        return;
    }

    const activeClassForAdmission = activeClasses.find(
      (cls) => cls.name === selectedClassName && cls.division === selectedDivision
    );

    if (!activeClassForAdmission) {
      toast({
        title: "Error: Class-Section Not Active",
        description: `The selected combination '${selectedClassName} - ${selectedDivision}' is not an active class-section. Please ask an Admin to activate it in 'Class Management' before admitting students.`,
        variant: "destructive",
        duration: 7000,
      });
      return;
    }
    const currentClassId = activeClassForAdmission.id;
    
    const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as User[];
    if (storedUsers.some((user:User) => user.email === email)) {
        toast({
          title: "Error",
          description: "A user (student/teacher) with this email already exists. Admission not processed.",
          variant: "destructive",
        });
        return;
    }
    
    const storedAdmissions = JSON.parse(localStorage.getItem(MOCK_ADMISSIONS_KEY) || '[]') as AdmissionRecord[];
    const newAdmissionId = `adm-${Date.now()}`;
    const newAdmissionRecord: AdmissionRecord = {
      id: newAdmissionId,
      name, email, dateOfBirth, guardianName, contactNumber, address,
      admissionDate: new Date().toISOString(),
      status: 'Admitted', 
      classId: currentClassId, 
    };

    const newStudentId = `s-${Date.now()}`;
    const newStudent: Student = {
      id: newStudentId,
      name, email,
      classId: currentClassId, 
      dateOfBirth, guardianName, contactNumber, address,
      admissionDate: newAdmissionRecord.admissionDate,
      profilePictureUrl: `https://placehold.co/100x100.png?text=${name.substring(0,1)}` 
    };
    
    const newUser: User = {
      id: newStudentId, 
      name, email,
      role: 'student',
      password: 'password' 
    };

    const updatedAdmissions = [...storedAdmissions, newAdmissionRecord];
    updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedAdmissions);

    const currentStoredStudents = JSON.parse(localStorage.getItem(MOCK_STUDENTS_KEY) || '[]') as Student[];
    const updatedStudents = [...currentStoredStudents, newStudent];
    updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

    const updatedUsers = [...storedUsers, newUser];
    updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);
    
    toast({ title: "Student Registered", description: `${name} has been admitted to ${selectedClassName} - ${selectedDivision} and a student account created.` });
    
    setName(''); setEmail(''); setDateOfBirth(''); setGuardianName(''); setContactNumber(''); setAddress('');
    setSelectedClassName(''); setSelectedDivision(''); setSelectedClassId('');
  };
  

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Register New Student"
        description="Fill in the details to admit a new student and assign them to a class."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FilePlus className="mr-2 h-5 w-5" />New Student Registration Form</CardTitle>
          <CardDescription>Provide student details and assign to an active class-section.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmitAdmission}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Student Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" required />
            </div>
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="guardianName">Guardian's Name</Label>
              <Input id="guardianName" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian's Full Name" required />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g., (555) 123-4567" required />
            </div>
            <div>
              <Label htmlFor="address">Full Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State, Zip Code" required />
            </div>
            
            <div>
              <Label htmlFor="classNameSelect">Assign to Class (Standard)</Label>
              <Select value={selectedClassName} onValueChange={handleClassNameChange}>
                <SelectTrigger id="classNameSelect">
                  <SelectValue placeholder="Select Class Standard" />
                </SelectTrigger>
                <SelectContent>
                  {allClassNames.length > 0 ? allClassNames.map(cName => (
                    <SelectItem key={cName.id} value={cName.name}>{cName.name}</SelectItem>
                  )) : <SelectItem value="no-class" disabled>No class names defined</SelectItem>}
                </SelectContent>
              </Select>
              {allClassNames.length === 0 && <p className="text-xs text-muted-foreground mt-1">No Class Names found. Ask Admin to define these in 'Class Management'.</p>}
            </div>
            <div>
              <Label htmlFor="divisionSelect">Assign to Section/Division</Label>
              <Select value={selectedDivision} onValueChange={handleDivisionChange} disabled={!selectedClassName || allSectionNames.length === 0}>
                <SelectTrigger id="divisionSelect">
                  <SelectValue placeholder="Select Section/Division" />
                </SelectTrigger>
                <SelectContent>
                  {allSectionNames.length > 0 ? allSectionNames.map(divName => (
                    <SelectItem key={divName.id} value={divName.name}>{divName.name}</SelectItem>
                  )) : <SelectItem value="no-division" disabled>No sections defined</SelectItem>}
                </SelectContent>
              </Select>
              {allSectionNames.length === 0 && <p className="text-xs text-muted-foreground mt-1">No Section Names found. Ask Admin to define these in 'Class Management'.</p>}
              {!selectedClassId && selectedClassName && selectedDivision && (
                 <p className="text-xs text-destructive mt-1">This class-section is not active. Ask Admin to activate it in Class Management.</p>
              )}
            </div>
             {activeClasses.length === 0 && allClassNames.length > 0 && allSectionNames.length > 0 && <p className="text-sm text-muted-foreground">No active class-sections defined from the available class/section names. Ask Admin to configure these in 'Class Management' first.</p>}

          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full"><UserPlus className="mr-2 h-4 w-4" />Register Student & Create Account</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

