
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClassData, FeeCategory } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FilePlus, UserPlus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getNewAdmissionPageDataAction, admitNewStudentAction } from '../actions';
import { supabase } from '@/lib/supabaseClient';
import { Checkbox } from '@/components/ui/checkbox';

export default function AdminNewAdmissionPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allFeeCategories, setAllFeeCategories] = useState<FeeCategory[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // New state for fee assignment
  const [shouldAssignFee, setShouldAssignFee] = useState(false);
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState<string>('');

  useEffect(() => {
    async function loadContext() {
      setIsFetchingInitialData(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (adminUserId) {
        const { data: userRec, error } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
        if (error || !userRec?.school_id) {
          toast({ title: "Error", description: "Admin not linked to a school. Cannot admit students.", variant: "destructive" });
          setIsFetchingInitialData(false);
          return;
        }
        setCurrentSchoolId(userRec.school_id);
        const result = await getNewAdmissionPageDataAction(userRec.school_id);
        if (result.ok) {
          setAllClasses(result.classes || []);
          setAllFeeCategories(result.feeCategories || []);
        } else {
          toast({ title: "Error", description: result.message || "Failed to load class list or fee categories.", variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      }
      setIsFetchingInitialData(false);
    }
    loadContext();
  }, [toast]);

  // New useEffect to manage fee category selection based on checkbox state
  useEffect(() => {
    if (!shouldAssignFee) {
      setSelectedFeeCategoryId('');
    }
  }, [shouldAssignFee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !selectedClassId || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, and Class are required.", variant: "destructive" });
      return;
    }
    // New validation: if fee is to be assigned, a category must be selected
    if (shouldAssignFee && !selectedFeeCategoryId) {
      toast({ title: "Error", description: "Please select a fee category to assign.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const result = await admitNewStudentAction({
      name, email, classId: selectedClassId, schoolId: currentSchoolId,
      dateOfBirth: dateOfBirth || undefined,
      guardianName: guardianName || undefined,
      contactNumber: contactNumber || undefined,
      address: address || undefined,
      profilePictureUrl: profilePictureUrl || undefined,
      feeCategoryId: shouldAssignFee ? (selectedFeeCategoryId || undefined) : undefined,
    });

    if (result.ok) {
      toast({ title: "Student Admitted", description: result.message });
      // Reset form
      setName(''); setEmail(''); setDateOfBirth(''); setGuardianName(''); 
      setContactNumber(''); setAddress(''); setSelectedClassId(''); setProfilePictureUrl('');
      setSelectedFeeCategoryId('');
      setShouldAssignFee(false);
    } else {
      toast({ title: "Admission Failed", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  if (isFetchingInitialData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="New Student Admission" />
        <Card className="max-w-2xl mx-auto w-full">
            <CardContent className="pt-6 text-center flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading admission form...
            </CardContent>
        </Card>
      </div>
    );
  }
  if (!currentSchoolId) {
    return (
       <div className="flex flex-col gap-6">
       <PageHeader title="New Student Admission" />
       <Card className="max-w-2xl mx-auto w-full">
            <CardContent className="pt-6 text-center text-destructive">
                Could not determine your school context. Please ensure your admin account is linked to a school.
            </CardContent>
        </Card>
       </div>
   );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Student Admission"
        description="Fill in the details to admit a new student and assign them to a class. Their admission fee will be assigned and will be pending payment."
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FilePlus className="mr-2 h-5 w-5" />New Student Registration Form</CardTitle>
          <CardDescription>A student account with the default password "password" will be created.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
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
              <Select value={selectedClassId} onValueChange={setSelectedClassId} required disabled={isLoading || allClasses.length === 0}>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {allClasses.length > 0 ? allClasses.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                  )) : <SelectItem value="no-class" disabled>No classes found for this school</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assignFeeCheckbox"
                  checked={shouldAssignFee}
                  onCheckedChange={(checked) => setShouldAssignFee(!!checked)}
                  disabled={isLoading || allFeeCategories.length === 0}
                />
                <Label htmlFor="assignFeeCheckbox" className="font-medium">Assign Admission Fee (Optional)</Label>
              </div>

              {shouldAssignFee && (
                <div className="pl-6 pt-2">
                  <Label htmlFor="feeCategorySelect" className="text-sm text-muted-foreground">Fee Category</Label>
                  <Select
                    value={selectedFeeCategoryId}
                    onValueChange={setSelectedFeeCategoryId}
                    required={shouldAssignFee}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="feeCategorySelect">
                      <SelectValue placeholder="Select a fee to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {allFeeCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name} (${cat.amount?.toFixed(2)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Select a fee to automatically assign it as 'Pending' to the student's account.</p>
                </div>
              )}
               {allFeeCategories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No fee categories are defined for this school.</p>
               )}
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
            <Button type="submit" className="w-full" disabled={isLoading || allClasses.length === 0 || !selectedClassId}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" /> }
                Admit Student & Create Account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
