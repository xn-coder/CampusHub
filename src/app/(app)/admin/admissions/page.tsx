
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdmissionRecord, Student, User, ClassData, ClassNameRecord, SectionRecord } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FilePlus, ListChecks, CheckSquare, UserPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const MOCK_ADMISSIONS_KEY = 'mockAdmissionsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_CLASSES_KEY = 'mockClassesData'; // For activated class-sections
const MOCK_CLASS_NAMES_KEY = 'mockClassNamesData';
const MOCK_SECTION_NAMES_KEY = 'mockSectionNamesData';


export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);

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
      const storedAdmissions = localStorage.getItem(MOCK_ADMISSIONS_KEY);
      if (storedAdmissions) setAdmissionRecords(JSON.parse(storedAdmissions));
      else localStorage.setItem(MOCK_ADMISSIONS_KEY, JSON.stringify([]));
      
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
    setSelectedDivision(''); // Reset division
    setSelectedClassId(''); // Reset class ID, will be re-validated on division change or submit
  };

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    // Validate if this combination is active
    const foundActiveClass = activeClasses.find(
      (cls) => cls.name === selectedClassName && cls.division === value
    );
    if (foundActiveClass) {
      setSelectedClassId(foundActiveClass.id);
    } else {
      setSelectedClassId('');
      if (selectedClassName && value) { // only show toast if both are selected but not active
        toast({
          title: "Combination Not Active",
          description: `The class-section '${selectedClassName} - ${value}' is not activated. Please activate it in Class Management if you wish to assign students.`,
          variant: "destructive",
          duration: 5000,
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
        description: `The selected combination '${selectedClassName} - ${selectedDivision}' is not an active class-section. Please activate it in 'Class Management' before admitting students.`,
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

    const updatedAdmissions = [...admissionRecords, newAdmissionRecord];
    setAdmissionRecords(updatedAdmissions);
    updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedAdmissions);

    const currentStoredStudents = JSON.parse(localStorage.getItem(MOCK_STUDENTS_KEY) || '[]') as Student[];
    const updatedStudents = [...currentStoredStudents, newStudent];
    updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

    const updatedUsers = [...storedUsers, newUser];
    updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);
    
    toast({ title: "Admission Submitted", description: `${name} has been admitted to ${selectedClassName} - ${selectedDivision} and a student account created.` });
    
    setName(''); setEmail(''); setDateOfBirth(''); setGuardianName(''); setContactNumber(''); setAddress('');
    setSelectedClassName(''); setSelectedDivision(''); setSelectedClassId('');
  };
  
  const handleEnrollStudent = (admissionId: string) => {
    const admission = admissionRecords.find(ar => ar.id === admissionId);
    if (admission) {
        const updatedRecords = admissionRecords.map(ar => 
            ar.id === admissionId ? {...ar, status: 'Enrolled'} : ar
        );
        setAdmissionRecords(updatedRecords);
        updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedRecords);
        toast({ title: "Student Enrolled", description: `${admission.name} is now marked as enrolled.` });
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student Admissions"
        description="Manage new student admission applications and enrollments."
      />
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><FilePlus className="mr-2 h-5 w-5" />New Admission Form</CardTitle>
            <CardDescription>Fill in the details to admit a new student.</CardDescription>
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
                {allClassNames.length === 0 && <p className="text-xs text-muted-foreground mt-1">Define class names in 'Class Management' first.</p>}
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
                {allSectionNames.length === 0 && <p className="text-xs text-muted-foreground mt-1">Define section names in 'Class Management' first.</p>}
                {!selectedClassId && selectedClassName && selectedDivision && (
                   <p className="text-xs text-destructive mt-1">This class-section is not active. Activate it in Class Management.</p>
                )}
              </div>
               {activeClasses.length === 0 && allClassNames.length > 0 && allSectionNames.length > 0 && <p className="text-sm text-muted-foreground">No active class-sections defined from the available class/section names. Please configure these combinations in 'Class Management' first.</p>}

            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full"><UserPlus className="mr-2 h-4 w-4" />Admit Student & Create Account</Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Admission Records</CardTitle>
            <CardDescription>List of submitted admission applications.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[calc(theme(space.96)_*_2)] overflow-y-auto">
            {admissionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No admission records yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Class Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admissionRecords.slice().reverse().map(record => {
                    const assignedClassDetails = activeClasses.find(c => c.id === record.classId);
                    const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
                    return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.email}</TableCell>
                      <TableCell>{classText}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'Enrolled' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          record.status === 'Admitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          record.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.status === 'Admitted' && (
                           <Button variant="outline" size="sm" onClick={() => handleEnrollStudent(record.id)}>
                             <CheckSquare className="mr-1 h-3 w-3" /> Enroll
                           </Button>
                        )}
                         {record.status === 'Enrolled' && (
                           <span className="text-sm text-green-600 dark:text-green-400">Enrolled</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


    