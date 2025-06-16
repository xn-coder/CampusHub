
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Teacher, User, Assignment } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, History, BookCheck, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TeacherProfilePage() {
  const { toast } = useToast();
  const [teacherDetails, setTeacherDetails] = useState<Teacher | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentCount, setAssignmentCount] = useState(0);

  useEffect(() => {
    async function fetchProfileData() {
      setIsLoading(true);
      const currentUserId = localStorage.getItem('currentUserId'); // This is User.id

      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Fetch User details (for email, basic name, role)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUserId)
        .single();

      if (userError || !userData) {
        toast({ title: "Error", description: "Could not fetch user data.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setUserDetails(userData as User);

      // Fetch Teacher Profile details (for subject, profile pic url, etc.)
      // The teacher's profile ID (teachers.id) is distinct from users.id
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', currentUserId) // Teacher profile linked by User.id
        .single();

      if (teacherError || !teacherData) {
        toast({ title: "Error", description: "Could not fetch teacher profile.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setTeacherDetails(teacherData as Teacher);

      // Fetch assignment count
      // Ensure 'teacher_id' in 'assignments' table refers to the teacher's profile ID (teachers.id)
      if (teacherData.id) {
        const { count, error: assignmentError } = await supabase
          .from('assignments')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', teacherData.id); // Use teacher's profile ID

        if (assignmentError) {
          console.error("Error fetching assignment count:", assignmentError);
          // Non-critical, so don't block page load
        } else {
          setAssignmentCount(count || 0);
        }
      }
      setIsLoading(false);
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
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading profile...</div>
        </div>
    );
  }

  if (!teacherDetails || !userDetails) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Profile" description="View and update your personal and professional information." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">Could not load your profile data. Please ensure you are logged in correctly or contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and manage your personal and professional information." 
      />
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={teacherDetails.profile_picture_url || undefined} alt={teacherDetails.name} data-ai-hint="person teacher" />
              <AvatarFallback className="text-3xl">{teacherDetails.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle>{teacherDetails.name}</CardTitle>
            <CardDescription>{userDetails.email}</CardDescription>
            <CardDescription>Role: {userDetails.role}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleMockPasswordReset}>
              <KeyRound className="mr-2 h-4 w-4" /> Reset Password
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Your information as recorded in the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="teacherName">Full Name</Label>
              <Input id="teacherName" value={teacherDetails.name} readOnly />
            </div>
            <div>
              <Label htmlFor="teacherEmail">Email</Label>
              <Input id="teacherEmail" type="email" value={userDetails.email} readOnly />
            </div>
            <div>
              <Label htmlFor="teacherSubject">Primary Subject</Label>
              <Input id="teacherSubject" value={teacherDetails.subject || 'N/A'} readOnly />
            </div>
            <p className="text-sm text-muted-foreground pt-4">To update your details, please contact the school administration.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/> Academic History (Mock Overview)</CardTitle>
          <CardDescription>A summary of your past academic activities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold flex items-center"><BookCheck className="mr-2 h-4 w-4 text-primary"/>Past Classes Taught (Examples):</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Grade 10A - Mathematics (2022-2023)</li>
              <li>Grade 9B - Physics (2021-2022)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-1">This is a placeholder. A full system would list actual past class assignments.</p>
          </div>
          <div>
             <h4 className="font-semibold flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary"/>Assignments Posted:</h4>
             <p className="text-sm text-muted-foreground">{assignmentCount} assignment(s) recorded in the system.</p>
          </div>
           <div>
             <h4 className="font-semibold flex items-center">Student Performance Trends (Placeholder):</h4>
             <p className="text-sm text-muted-foreground">This section would show an overview of student performance in your past classes.</p>
          </div>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">This is a simplified mock history. A complete academic history feature would involve more detailed data tracking over time.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
