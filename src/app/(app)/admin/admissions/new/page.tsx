
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
  const [rollNumber, setRollNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // New state for fee assignment
  const [shouldAssignFee, setShouldAssignFee] = useState(false);
  const [selectedFees, setSelectedFees] = useState<Record<string, { selected: boolean; amount: string }>>({});

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
          // Initialize selectedFees state
          const initialFeesState = (result.feeCategories || []).reduce((acc, cat) => {
            acc[cat.id] = { selected: false, amount: cat.amount?.toString() || '' };
            return acc;
          }, {} as Record<string, { selected: boolean; amount: string }>);
          setSelectedFees(initialFeesState);

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

  const handleFeeSelectionChange = (categoryId: string, isSelected: boolean) => {
    setSelectedFees(prev => ({
        ...prev,
        [categoryId]: {
            ...prev[categoryId],
            selected: isSelected,
        }
    }));
  };

  const handleAmountChange = (categoryId: string, amount: string) => {
    setSelectedFees(prev => ({
        ...prev,
        [categoryId]: {
            ...(prev[categoryId] || { selected: true }),
            amount: amount
        }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File too large", description: "Profile picture should be less than 2MB.", variant: "destructive" });
      setProfilePictureFile(null);
      e.target.value = '';
      return;
    }
    setProfilePictureFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email || !selectedClassId || !currentSchoolId) {
      toast({ title: "Error", description: "Name, Email, and Class are required.", variant: "destructive" });
      return;
    }
    
    const feesToAssign = Object.entries(selectedFees)
        .filter(([, val]) => val.selected && val.amount && Number(val.amount) > 0)
        .map(([categoryId, val]) => ({
            categoryId,
            amount: Number(val.amount)
        }));

    if (shouldAssignFee && feesToAssign.length === 0) {
      toast({ title: "Error", description: "Please select at least one fee category and enter a valid amount.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('classId', selectedClassId);
    formData.append('schoolId', currentSchoolId);
    if(rollNumber) formData.append('rollNumber', rollNumber);
    if(dateOfBirth) formData.append('dateOfBirth', dateOfBirth);
    if(guardianName) formData.append('guardianName', guardianName);
    if(contactNumber) formData.append('contactNumber', contactNumber);
    if(address) formData.append('address', address);
    if(shouldAssignFee) formData.append('feesToAssign', JSON.stringify(feesToAssign));
    if(profilePictureFile) formData.append('profilePictureFile', profilePictureFile);

    const result = await admitNewStudentAction(formData);

    if (result.ok) {
      toast({ title: "Student Admitted", description: result.message });
      // Reset form
      setName(''); setEmail(''); setDateOfBirth(''); setGuardianName(''); 
      setContactNumber(''); setAddress(''); setSelectedClassId('');
      setProfilePictureFile(null);
      (document.getElementById('profilePictureFile') as HTMLInputElement).value = ''; // Reset file input
      setRollNumber('');
      const resetFees = Object.keys(selectedFees).reduce((acc, key) => {
        acc[key] = { ...selectedFees[key], selected: false };
        return acc;
      }, {} as typeof selectedFees);
      setSelectedFees(resetFees);
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
        description="Fill in the details to admit a new student. This will create their account and profile with an 'Admitted' status. You can then mark them as 'Enrolled' from the admissions list after fee payment."
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
              <Label htmlFor="rollNumber">Roll Number (Optional)</Label>
              <Input id="rollNumber" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Custom Student ID / Roll No." disabled={isLoading}/>
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
                <Label htmlFor="assignFeeCheckbox" className="font-medium">Assign Fees (Optional)</Label>
              </div>

              {shouldAssignFee && (
                <div className="pl-6 pt-2">
                  <Label className="text-sm text-muted-foreground">Fee Categories &amp; Amounts</Label>
                  <div className="max-h-60 overflow-y-auto space-y-3 p-2 border mt-1 rounded-md">
                    {allFeeCategories.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-3 rounded-md">
                        <Checkbox
                            id={`fee-cat-${cat.id}`}
                            checked={selectedFees[cat.id]?.selected || false}
                            onCheckedChange={(checked) => handleFeeSelectionChange(cat.id, !!checked)}
                            disabled={isLoading}
                        />
                        <Label htmlFor={`fee-cat-${cat.id}`} className="font-normal w-full cursor-pointer">
                          {cat.name}
                        </Label>
                        <Input
                            type="number"
                            placeholder="Amount"
                            className="w-32"
                            value={selectedFees[cat.id]?.amount || ''}
                            onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                            disabled={isLoading || !selectedFees[cat.id]?.selected}
                            required={selectedFees[cat.id]?.selected}
                            step="0.01"
                            min="0.01"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Select fees and specify the amount to be assigned as 'Pending' to the student's account.</p>
                </div>
              )}
               {allFeeCategories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1 pl-6">No fee categories are defined for this school.</p>
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
              <Label htmlFor="profilePictureFile">Profile Picture (Optional, &lt;2MB)</Label>
              <Input id="profilePictureFile" type="file" onChange={handleFileChange} accept="image/png, image/jpeg" disabled={isLoading}/>
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
