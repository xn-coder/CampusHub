
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Building, Loader2 } from 'lucide-react';
import { createSchoolAndAdminAction } from './actions'; // Server Action

export default function CreateSchoolPage() {
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    if (!schoolName || !schoolAddress || !adminName || !adminEmail) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const result = await createSchoolAndAdminAction({
      schoolName,
      schoolAddress,
      adminName,
      adminEmail,
    });

    if (result.ok) {
      toast({
        title: "School & Admin Created",
        description: result.message,
      });
      setSchoolName('');
      setSchoolAddress('');
      setAdminName('');
      setAdminEmail('');
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsLoading(false);
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
          <CardDescription>Provide the necessary information for the new school and its administrator. The admin password will be "password".</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schoolName">School Name</Label>
              <Input id="schoolName" name="schoolName" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g., Springfield Elementary" required disabled={isLoading} />
            </div>
            <div>
              <Label htmlFor="schoolAddress">School Address</Label>
              <Input id="schoolAddress" name="schoolAddress" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} placeholder="123 Main Street, Anytown, USA" required disabled={isLoading} />
            </div>
            <hr className="my-4"/>
            <h3 className="text-lg font-medium text-foreground">Administrator Credentials</h3>
            <CardDescription>The administrator will be able to log in with the email below and the default password: "password".</CardDescription>
             <div className="pt-2">
              <Label htmlFor="adminName">Administrator Full Name</Label>
              <Input id="adminName" name="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g., Seymour Skinner" required disabled={isLoading} />
            </div>
            <div>
              <Label htmlFor="adminEmail">Administrator Email (Login ID)</Label>
              <Input id="adminEmail" name="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@springfieldelementary.edu" required disabled={isLoading} />
            </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" />}
                {isLoading ? 'Creating...' : 'Create School & Admin Account'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
