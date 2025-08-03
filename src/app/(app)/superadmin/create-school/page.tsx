

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Building, Loader2, UploadCloud } from 'lucide-react';
import { createSchoolAndAdminAction } from './actions'; 

export default function CreateSchoolPage() {
  const { toast } = useToast();
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File too large", description: "Logo should be less than 2MB.", variant: "destructive" });
      setLogoFile(null);
      e.target.value = '';
      return;
    }
    setLogoFile(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!schoolName || !schoolAddress || !adminName || !adminEmail) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('schoolName', schoolName);
    formData.append('schoolAddress', schoolAddress);
    formData.append('adminName', adminName);
    formData.append('adminEmail', adminEmail);
    if(logoFile) {
        formData.append('logoFile', logoFile);
    }
    
    // The action now needs to be adapted to handle FormData
    // For now, passing as an object as the action expects. Let's create an action that can take FormData.
    const result = await createSchoolAndAdminAction({
      schoolName, schoolAddress, adminName, adminEmail, logoFile: logoFile || undefined
    });

    if (result.ok) {
      toast({
        title: "School & Principal Created",
        description: result.message,
      });
      setSchoolName('');
      setSchoolAddress('');
      setAdminName('');
      setAdminEmail('');
      setLogoFile(null);
      const fileInput = document.getElementById('logoFile') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
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
        description="Fill in the details to register a new school and its primary principal." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-6 w-6" /> New School Registration</CardTitle>
          <CardDescription>Provide the necessary information for the new school and its principal. The admin password will be "password".</CardDescription>
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
            <div>
              <Label htmlFor="logoFile">School Logo (Optional, &lt;2MB)</Label>
              <Input id="logoFile" name="logoFile" type="file" onChange={handleFileChange} accept="image/png, image/jpeg" disabled={isLoading}/>
            </div>
            <hr className="my-4"/>
            <h3 className="text-lg font-medium text-foreground">Principal Credentials</h3>
            <CardDescription>The principal will be able to log in with the email below and the default password: "password".</CardDescription>
             <div className="pt-2">
              <Label htmlFor="adminName">Principal Full Name</Label>
              <Input id="adminName" name="adminName" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="e.g., Seymour Skinner" required disabled={isLoading} />
            </div>
            <div>
              <Label htmlFor="adminEmail">Principal Email (Login ID)</Label>
              <Input id="adminEmail" name="adminEmail" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="principal@springfieldelementary.edu" required disabled={isLoading} />
            </div>
          </CardContent>
          <CardFooter>
             <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" />}
                {isLoading ? 'Creating...' : 'Create School & Principal Account'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
