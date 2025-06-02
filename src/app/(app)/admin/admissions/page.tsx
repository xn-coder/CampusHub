
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdmissionRecord, Student, User, ClassData } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FilePlus, ListChecks, CheckSquare, UserPlus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const MOCK_ADMISSIONS_KEY = 'mockAdmissionsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_CLASSES_KEY = 'mockClassesData';


export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');

  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>(''); // This will be student.classId

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAdmissions = localStorage.getItem(MOCK_ADMISSIONS_KEY);
      if (storedAdmissions) {
        setAdmissionRecords(JSON.parse(storedAdmissions));
      }
      if (!localStorage.getItem(MOCK_STUDENTS_KEY)) {
        localStorage.setItem(MOCK_STUDENTS_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(MOCK_USER_DB_KEY)) {
        localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify([]));
      }
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      if (storedClasses) {
        setAllClasses(JSON.parse(storedClasses));
      } else {
        localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify([])); // Initialize if not present
      }
    }
  }, []);

  const updateLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const availableClassNames = useMemo(() => {
    return [...new Set(allClasses.map(cls => cls.name))].sort();
  }, [allClasses]);

  const availableDivisions = useMemo(() => {
    if (!selectedClassName) return [];
    return allClasses
      .filter(cls => cls.name === selectedClassName)
      .map(cls => cls.division)
      .sort();
  }, [allClasses, selectedClassName]);

  const handleClassNameChange = (value: string) => {
    setSelectedClassName(value);
    setSelectedDivision('');
    setSelectedClassId('');
  };

  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    const foundClass = allClasses.find(cls => cls.name === selectedClassName && cls.division === value);
    if (foundClass) {
      setSelectedClassId(foundClass.id);
    } else {
      setSelectedClassId('');
    }
  };

  const handleSubmitAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !dateOfBirth || !guardianName || !contactNumber || !address) {
      toast({ title: "Error", description: "All student details are required.", variant: "destructive" });
      return;
    }
    if (!selectedClassId) {
        toast({ title: "Error", description: "Please select a class and section for the student.", variant: "destructive" });
        return;
    }
    
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
      classId: selectedClassId, 
    };

    const newStudentId = `s-${Date.now()}`;
    const newStudent: Student = {
      id: newStudentId,
      name, email,
      classId: selectedClassId, 
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

    const currentStoredStudents = JSON.parse(localStorage.getItem(MOCK_STUDENTS_KEY) || '[]');
    const updatedStudents = [...currentStoredStudents, newStudent];
    updateLocalStorage(MOCK_STUDENTS_KEY, updatedStudents);

    const updatedUsers = [...storedUsers, newUser];
    updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);
    
    const assignedClass = allClasses.find(c => c.id === selectedClassId);
    const assignedClassText = assignedClass ? `${assignedClass.name} - ${assignedClass.division}` : 'Selected Class';

    toast({ title: "Admission Submitted", description: `${name} has been admitted to ${assignedClassText} and a student account created.` });
    
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="classNameSelect">Assign to Class</Label>
                    <Select value={selectedClassName} onValueChange={handleClassNameChange}>
                      <SelectTrigger id="classNameSelect">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClassNames.length > 0 ? availableClassNames.map(cName => (
                          <SelectItem key={cName} value={cName}>{cName}</SelectItem>
                        )) : <SelectItem value="no-class" disabled>No classes available</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="divisionSelect">Assign to Section/Division</Label>
                    <Select value={selectedDivision} onValueChange={handleDivisionChange} disabled={!selectedClassName || availableDivisions.length === 0}>
                      <SelectTrigger id="divisionSelect">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDivisions.length > 0 ? availableDivisions.map(divName => (
                          <SelectItem key={divName} value={divName}>{divName}</SelectItem>
                        )) : <SelectItem value="no-division" disabled>No sections for this class</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
              </div>
               {allClasses.length === 0 && <p className="text-sm text-muted-foreground">No classes defined. Please add classes in 'Class Management' first.</p>}


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
          <CardContent className="max-h-[calc(theme(space.96)_*_2)] overflow-y-auto"> {/* Adjusted max height */}
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
                    const assignedClassDetails = allClasses.find(c => c.id === record.classId);
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

    