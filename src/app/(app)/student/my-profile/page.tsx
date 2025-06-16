
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
import { KeyRound, School, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function StudentProfilePage() {
  const { toast } = useToast();
  const [studentDetails, setStudentDetails] = useState<Student | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [classDetails, setClassDetails] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfileData() {
      setIsLoading(true);
      const currentUserId = localStorage.getItem('currentUserId'); 
      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive"});
        setIsLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUserId)
          .single();

        if (userError || !userData) {
          toast({ title: "Error", description: "Could not fetch user data.", variant: "destructive"});
          setIsLoading(false);
          return;
        }
        setUserDetails(userData as User);

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', currentUserId) 
          .single();

        if (studentError || !studentData) {
          toast({ title: "Error", description: "Could not fetch student profile.", variant: "destructive"});
          setIsLoading(false);
          return;
        }
        setStudentDetails(studentData as Student);

        if (studentData.class_id) {
          const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('*')
            .eq('id', studentData.class_id)
            .single();

          if (classError) {
            console.warn("Could not fetch class details for student:", classError?.message);
          } else {
            setClassDetails(classData as ClassData);
          }
        }
      } catch (error: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive"});
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfileData();
  }, [toast]);

  const handleMockPasswordReset = () => {
    toast({
      title: "Password Reset (Mock)",
      description: "In a real application, a password reset link would be sent or a modal would appear to change your password.",
    });
  };

  if (isLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="My Profile" />
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading profile...</div>
        </div>
    );
  }

  if (!studentDetails || !userDetails) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Profile" description="View and update your personal information." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">Could not load your profile data. Please ensure you are logged in correctly or contact support.</p>
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
              <AvatarImage src={studentDetails.profile_picture_url || undefined} alt={studentDetails.name} data-ai-hint="person student" />
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
              <Input id="studentDob" value={studentDetails.date_of_birth || 'N/A'} readOnly />
            </div>
             <div>
              <Label htmlFor="studentGuardian">Guardian&apos;s Name</Label>
              <Input id="studentGuardian" value={studentDetails.guardian_name || 'N/A'} readOnly />
            </div>
             <div>
              <Label htmlFor="studentContact">Contact Number</Label>
              <Input id="studentContact" value={studentDetails.contact_number || 'N/A'} readOnly />
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
