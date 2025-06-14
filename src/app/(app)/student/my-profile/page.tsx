
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Student, User, ClassData } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, School } from 'lucide-react';

const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_CLASSES_KEY = 'mockClassesData';

export default function StudentProfilePage() {
  const { toast } = useToast();
  const [studentDetails, setStudentDetails] = useState<Student | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [classDetails, setClassDetails] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUserId = localStorage.getItem('currentUserId');
      if (currentUserId) {
        const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
        const students: Student[] = storedStudents ? JSON.parse(storedStudents) : [];
        const foundStudent = students.find(s => s.id === currentUserId);
        setStudentDetails(foundStudent || null);

        const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
        const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
        const foundUser = users.find(u => u.id === currentUserId);
        setUserDetails(foundUser || null);

        if (foundStudent && foundStudent.classId) {
          const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
          const classes: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
          const foundClass = classes.find(c => c.id === foundStudent.classId);
          setClassDetails(foundClass || null);
        }
      }
      setIsLoading(false);
    }
  }, []);

  const handleMockPasswordReset = () => {
    toast({
      title: "Password Reset (Mock)",
      description: "In a real application, a password reset link would be sent or a modal would appear to change your password.",
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading profile...</p></div>;
  }

  if (!studentDetails || !userDetails) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Profile" description="View and update your personal information." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">Could not load your profile data. Please ensure you are logged in correctly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const classDisplayText = classDetails ? `${classDetails.name} - ${classDetails.division}` : 'Not Assigned';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and update your personal information." 
      />
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={studentDetails.profilePictureUrl} alt={studentDetails.name} data-ai-hint="person student" />
              <AvatarFallback className="text-3xl">{studentDetails.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle>{studentDetails.name}</CardTitle>
            <CardDescription>{userDetails.email}</CardDescription>
             <CardDescription className="flex items-center justify-center"><School className="mr-1 h-4 w-4"/> {classDisplayText}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={handleMockPasswordReset}>
              <KeyRound className="mr-2 h-4 w-4" /> Reset Password
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your details as recorded in the school system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="studentName">Full Name</Label>
              <Input id="studentName" value={studentDetails.name} readOnly />
            </div>
            <div>
              <Label htmlFor="studentEmail">Email</Label>
              <Input id="studentEmail" type="email" value={userDetails.email} readOnly />
            </div>
            <div>
              <Label htmlFor="studentDob">Date of Birth</Label>
              <Input id="studentDob" value={studentDetails.dateOfBirth || 'N/A'} readOnly />
            </div>
             <div>
              <Label htmlFor="studentGuardian">Guardian&apos;s Name</Label>
              <Input id="studentGuardian" value={studentDetails.guardianName || 'N/A'} readOnly />
            </div>
             <div>
              <Label htmlFor="studentContact">Contact Number</Label>
              <Input id="studentContact" value={studentDetails.contactNumber || 'N/A'} readOnly />
            </div>
             <div>
              <Label htmlFor="studentAddress">Address</Label>
              <Input id="studentAddress" value={studentDetails.address || 'N/A'} readOnly />
            </div>
            <p className="text-sm text-muted-foreground pt-4">To update your personal details, please contact the school administration or your class teacher.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
