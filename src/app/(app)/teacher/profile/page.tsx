
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Teacher, User } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { KeyRound } from 'lucide-react';

const MOCK_TEACHERS_KEY = 'mockTeachersData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';

export default function TeacherProfilePage() {
  const { toast } = useToast();
  const [teacherDetails, setTeacherDetails] = useState<Teacher | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUserId = localStorage.getItem('currentUserId');
      if (currentUserId) {
        const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
        const teachers: Teacher[] = storedTeachers ? JSON.parse(storedTeachers) : [];
        const foundTeacher = teachers.find(t => t.id === currentUserId);
        setTeacherDetails(foundTeacher || null);

        const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
        const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
        const foundUser = users.find(u => u.id === currentUserId);
        setUserDetails(foundUser || null);
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

  if (!teacherDetails || !userDetails) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Profile" description="Your personal and professional information." />
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">Could not load your profile data. Please ensure you are logged in correctly.</p>
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
              <AvatarImage src={teacherDetails.profilePictureUrl} alt={teacherDetails.name} data-ai-hint="person teacher" />
              <AvatarFallback className="text-3xl">{teacherDetails.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <CardTitle>{teacherDetails.name}</CardTitle>
            <CardDescription>{userDetails.email}</CardDescription>
            <CardDescription>Role: {userDetails.role}</CardDescription>
          </CardHeader>
          <CardContent>
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
              <Input id="teacherSubject" value={teacherDetails.subject} readOnly />
            </div>
            {/* Placeholder for more details */}
            <p className="text-sm text-muted-foreground pt-4">To update your details, please contact the school administration.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
