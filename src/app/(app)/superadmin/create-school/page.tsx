
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import type { User } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Building } from 'lucide-react';

const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_SCHOOLS_DB_KEY = 'mockSchoolsDatabase'; // For storing school details (mock)

interface SchoolData {
  id: string;
  name: string;
  address: string;
  adminEmail: string;
  adminName: string;
}

export default function CreateSchoolPage() {
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  // Admin password is fixed to "password"

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schoolName || !schoolAddress || !adminName || !adminEmail) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }

    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      let users: User[] = storedUsers ? JSON.parse(storedUsers) : [];

      if (users.some(user => user.email === adminEmail)) {
        toast({
          title: "Error Creating Admin",
          description: "An admin with this email already exists.",
          variant: "destructive",
        });
        return;
      }
      
      const newAdminId = `admin-${Date.now()}`;
      const newAdminUser: User = {
        id: newAdminId,
        name: adminName,
        email: adminEmail,
        role: 'admin',
        password: 'password' // Default password
      };
      users.push(newAdminUser);
      localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify(users));

      // Mock saving school details
      const storedSchools = localStorage.getItem(MOCK_SCHOOLS_DB_KEY);
      let schools: SchoolData[] = storedSchools ? JSON.parse(storedSchools) : [];
      const newSchoolId = `school-${Date.now()}`;
      const newSchool: SchoolData = {
        id: newSchoolId,
        name: schoolName,
        address: schoolAddress,
        adminEmail: adminEmail,
        adminName: adminName,
      };
      schools.push(newSchool);
      localStorage.setItem(MOCK_SCHOOLS_DB_KEY, JSON.stringify(schools));


      toast({
        title: "School & Admin Created",
        description: `${schoolName} has been registered and an admin account for ${adminEmail} created with default password 'password'.`,
      });

      // Reset form
      setSchoolName('');
      setSchoolAddress('');
      setAdminName('');
      setAdminEmail('');

    } else {
      toast({ title: "Error", description: "Could not access local storage.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Create New School" 
        description="Fill in the details to register a new school and its primary administrator." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-6 w-6" /> New School Registration</CardTitle>
          <CardDescription>Provide the necessary information for the new school and its administrator.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schoolName">School Name</Label>
              <Input id="schoolName" name="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g., Springfield Elementary" required />
            </div>
            <div>
              <Label htmlFor="schoolAddress">School Address</Label>
              <Input id="schoolAddress" name="schoolAddress" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} placeholder="123 Main Street, Anytown, USA" required />
            </div>
            <hr className="my-4"/>
            <h3 className="text-lg font-medium text-foreground">Administrator Credentials</h3>
            <CardDescription>The administrator will be able to log in with the email below and the default password: "password".</CardDescription>
             <div className="pt-2">
              <Label htmlFor="adminName">Administrator Full Name</Label>
              <Input id="adminName" name="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g., Seymour Skinner" required />
            </div>
            <div>
              <Label htmlFor="adminEmail">Administrator Email (Login ID)</Label>
              <Input id="adminEmail" name="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@springfieldelementary.edu" required />
            </div>
            {/* Password field removed as it's defaulted */}
          </CardContent>
          <CardFooter>
             <Button type="submit" className="w-full">Create School & Admin Account</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
