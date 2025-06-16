
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClassData, UserRole, Student } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FilePlus, UserPlus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { registerStudentAction } from './actions';


export default function TeacherRegisterStudentPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');

  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    const teacherUserId = localStorage.getItem('currentUserId'); 
    if (teacherUserId) {
      
      supabase.from('teachers').select('id, school_id').eq('user_id', teacherUserId).single()
        .then(({ data: teacherProfile, error: profileError }) => {
          if (profileError || !teacherProfile) {
            toast({ title: "Error", description: "Could not load teacher profile. Unable to register students.", variant: "destructive"});
            setIsLoading(false);
            return;
          }
          setCurrentTeacherId(teacherProfile.id); 
          setCurrentSchoolId(teacherProfile.school_id);

          
          supabase.from('classes')
            .select('id, name, division')
            .eq('teacher_id', teacherProfile.id) 
            .eq('school_id', teacherProfile.school_id)
            .then(({ data: classesData, error: classesError }) => {
              if (classesError) {
                toast({ title: "Error", description: "Failed to fetch assigned classes.", variant: "destructive"});
              } else {
                setTeacherAssignedClasses(classesData || []);
              }
              setIsLoading(false);
            });
        });
    } else {
        toast({ title: "Error", description: "Teacher not identified. Please log in.", variant: "destructive"});
        setIsLoading(false);
    }
  }, [toast]);


  const handleSubmitAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !selectedClassId || !currentSchoolId) {
      toast({ title: "Error", description: "Student Name, Email, and assigned Class are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const result = await registerStudentAction({
      name, email, date_of_birth: dateOfBirth, guardian_name: guardianName, contact_number: contactNumber, address,
      classId: selectedClassId,
      schoolId: currentSchoolId,
      profilePictureUrl
    });

    if (result.ok) {
      toast({ title: "Student Registered", description: result.message });
      setName(''); setEmail(''); setDateOfBirth(''); setGuardianName(''); 
      setContactNumber(''); setAddress(''); setSelectedClassId(''); setProfilePictureUrl('');
      // Note: This page doesn't display a list of students itself,
      // so re-fetching students here isn't directly needed for this page's UI.
      // `revalidatePath` in the action should handle other pages.
    } else {
      toast({ title: "Registration Failed", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  

  if (isLoading && !currentSchoolId) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading teacher data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
     return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Register New Student" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association. Please ensure your teacher account is correctly set up by an admin.
        </CardContent></Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Register New Student"
        description="Fill in the details to admit a new student and assign them to one of your classes."
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FilePlus className="mr-2 h-5 w-5" />New Student Registration Form</CardTitle>
          <CardDescription>Provide student details and assign to an active class-section you teach. Default password will be "password".</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmitAdmission}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Student Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="email">Email Address (Login ID)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" required disabled={isLoading}/>
            </div>
             <div>
              <Label htmlFor="classSelect">Assign to Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} required disabled={isLoading}>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Select one of your classes" />
                </SelectTrigger>
                <SelectContent>
                  {teacherAssignedClasses.length > 0 ? teacherAssignedClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                  )) : <SelectItem value="no-class" disabled>No classes assigned to you</SelectItem>}
                </SelectContent>
              </Select>
              {teacherAssignedClasses.length === 0 && <p className="text-xs text-muted-foreground mt-1">You are not assigned as a teacher to any active classes. Please contact an admin.</p>}
            </div>
            <hr className="my-3"/>
            <p className="text-sm text-muted-foreground">Optional Details:</p>
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="guardianName">Guardian's Name</Label>
              <Input id="guardianName" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian's Full Name" disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g., (555) 123-4567" disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="address">Full Address</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State, Zip Code" disabled={isLoading}/>
            </div>
             <div>
              <Label htmlFor="profilePictureUrl">Profile Picture URL</Label>
              <Input id="profilePictureUrl" value={profilePictureUrl} onChange={(e) => setProfilePictureUrl(e.target.value)} placeholder="https://example.com/image.png" disabled={isLoading}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || teacherAssignedClasses.length === 0 || !selectedClassId}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" /> }
                Register Student & Create Account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}


