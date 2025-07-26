
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nationality, setNationality] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);

  const [fatherName, setFatherName] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [parentContactNumber, setParentContactNumber] = useState('');
  const [annualFamilyIncome, setAnnualFamilyIncome] = useState('');
  
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
    if (!name || !email || !selectedClassId || !currentSchoolId || !contactNumber || !parentContactNumber) {
      toast({ title: "Error", description: "Student's Name, Email, Class, and both Contact Numbers are required.", variant: "destructive" });
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
    formData.append('contactNumber', contactNumber);
    if(dateOfBirth) formData.append('dateOfBirth', dateOfBirth);
    if(gender) formData.append('gender', gender);
    if(bloodGroup) formData.append('bloodGroup', bloodGroup);
    if(nationality) formData.append('nationality', nationality);
    if(address) formData.append('address', address);
    
    if(fatherName) formData.append('fatherName', fatherName);
    if(fatherOccupation) formData.append('fatherOccupation', fatherOccupation);
    if(motherName) formData.append('motherName', motherName);
    if(motherOccupation) formData.append('motherOccupation', motherOccupation);
    if(guardianName) formData.append('guardianName', guardianName);
    formData.append('parentContactNumber', parentContactNumber);
    if(annualFamilyIncome) formData.append('annualFamilyIncome', annualFamilyIncome);
    
    formData.append('classId', selectedClassId);
    formData.append('rollNumber', rollNumber);
    formData.append('schoolId', currentSchoolId);
    
    if(shouldAssignFee) formData.append('feesToAssign', JSON.stringify(feesToAssign));
    if(profilePictureFile) formData.append('profilePictureFile', profilePictureFile);

    const result = await admitNewStudentAction(formData);

    if (result.ok) {
      toast({ title: "Student Admitted", description: result.message });
      // Reset form
      setName(''); setEmail(''); setContactNumber(''); setDateOfBirth(''); setGender(''); setBloodGroup(''); setNationality(''); setAddress('');
      setFatherName(''); setFatherOccupation(''); setMotherName(''); setMotherOccupation(''); setGuardianName(''); setParentContactNumber(''); setAnnualFamilyIncome('');
      setSelectedClassId(''); setRollNumber('');
      setProfilePictureFile(null);
      const fileInput = document.getElementById('profilePictureFile') as HTMLInputElement;
      if (fileInput) fileInput.value = ''; // Reset file input
      
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
        <Card className="max-w-4xl mx-auto w-full">
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
       <Card className="max-w-4xl mx-auto w-full">
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
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FilePlus className="mr-2 h-5 w-5" />New Student Registration Form</CardTitle>
          <CardDescription>A student account with the default password "password" will be created.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            
            {/* Personal Info */}
            <div className="space-y-4 border p-4 rounded-md">
              <h3 className="text-lg font-medium">Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label htmlFor="name">Student Full Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required disabled={isLoading}/></div>
                <div><Label htmlFor="email">Email Address (Login ID)</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" required disabled={isLoading}/></div>
                <div><Label htmlFor="contactNumber">Contact Number</Label><Input id="contactNumber" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Student's contact no." required disabled={isLoading}/></div>
                <div><Label htmlFor="dateOfBirth">Date of Birth</Label><Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={isLoading}/></div>
                <div>
                    <Label>Gender</Label>
                    <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Male" id="gender-male"/><Label htmlFor="gender-male">Male</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Female" id="gender-female"/><Label htmlFor="gender-female">Female</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Other" id="gender-other"/><Label htmlFor="gender-other">Other</Label></div>
                    </RadioGroup>
                </div>
                 <div>
                    <Label htmlFor="bloodGroup">Blood Group</Label>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}><SelectTrigger id="bloodGroup"><SelectValue placeholder="Select blood group"/></SelectTrigger>
                        <SelectContent><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem><SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem></SelectContent>
                    </Select>
                 </div>
                 <div><Label htmlFor="nationality">Nationality</Label><Input id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g., Indian" disabled={isLoading}/></div>
                 <div className="md:col-span-2"><Label htmlFor="address">Full Address</Label><Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State, Zip Code" disabled={isLoading}/></div>
                 <div><Label htmlFor="profilePictureFile">Profile Picture (Optional, &lt;2MB)</Label><Input id="profilePictureFile" type="file" onChange={handleFileChange} accept="image/png, image/jpeg" disabled={isLoading}/></div>
              </div>
            </div>

            {/* Parent/Guardian Info */}
            <div className="space-y-4 border p-4 rounded-md">
                <h3 className="text-lg font-medium">Parent/Guardian Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><Label htmlFor="fatherName">Father's Name</Label><Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's Full Name" disabled={isLoading}/></div>
                  <div><Label htmlFor="fatherOccupation">Father's Occupation</Label><Input id="fatherOccupation" value={fatherOccupation} onChange={(e) => setFatherOccupation(e.target.value)} placeholder="e.g., Engineer" disabled={isLoading}/></div>
                  <div><Label htmlFor="motherName">Mother's Name</Label><Input id="motherName" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Mother's Full Name" disabled={isLoading}/></div>
                  <div><Label htmlFor="motherOccupation">Mother's Occupation</Label><Input id="motherOccupation" value={motherOccupation} onChange={(e) => setMotherOccupation(e.target.value)} placeholder="e.g., Doctor" disabled={isLoading}/></div>
                  <div><Label htmlFor="guardianName">Guardian's Name (if applicable)</Label><Input id="guardianName" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian's Full Name" disabled={isLoading}/></div>
                  <div><Label htmlFor="parentContactNumber">Parent/Guardian Contact No.</Label><Input id="parentContactNumber" type="tel" value={parentContactNumber} onChange={(e) => setParentContactNumber(e.target.value)} placeholder="Primary contact number" required disabled={isLoading}/></div>
                  <div className="md:col-span-2"><Label htmlFor="annualFamilyIncome">Annual Family Income (INR)</Label><Input id="annualFamilyIncome" type="number" value={annualFamilyIncome} onChange={(e) => setAnnualFamilyIncome(e.target.value)} placeholder="e.g., 500000" disabled={isLoading}/></div>
                </div>
            </div>

            {/* School & Fee Info */}
             <div className="space-y-4 border p-4 rounded-md">
                <h3 className="text-lg font-medium">School & Fee Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="classSelect">Assign to Class</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId} required disabled={isLoading || allClasses.length === 0}>
                            <SelectTrigger id="classSelect"><SelectValue placeholder="Select a class" /></SelectTrigger>
                            <SelectContent>{allClasses.length > 0 ? allClasses.map(cls => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>)) : <SelectItem value="no-class" disabled>No classes found</SelectItem>}</SelectContent>
                        </Select>
                    </div>
                     <div><Label htmlFor="rollNumber">Roll Number (Optional)</Label><Input id="rollNumber" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="Custom Student ID / Roll No." disabled={isLoading}/></div>
                </div>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="assignFeeCheckbox" checked={shouldAssignFee} onCheckedChange={(checked) => setShouldAssignFee(!!checked)} disabled={isLoading || allFeeCategories.length === 0}/>
                    <Label htmlFor="assignFeeCheckbox" className="font-medium">Assign Fees (Optional)</Label>
                  </div>
                  {shouldAssignFee && (
                    <div className="pl-6 pt-2"><Label className="text-sm text-muted-foreground">Fee Categories &amp; Amounts</Label>
                      <div className="max-h-60 overflow-y-auto space-y-3 p-2 border mt-1 rounded-md">
                        {allFeeCategories.map(cat => (
                          <div key={cat.id} className="flex items-center space-x-3 rounded-md">
                            <Checkbox id={`fee-cat-${cat.id}`} checked={selectedFees[cat.id]?.selected || false} onCheckedChange={(checked) => handleFeeSelectionChange(cat.id, !!checked)} disabled={isLoading}/>
                            <Label htmlFor={`fee-cat-${cat.id}`} className="font-normal w-full cursor-pointer">{cat.name}</Label>
                            <Input type="number" placeholder="Amount" className="w-32" value={selectedFees[cat.id]?.amount || ''} onChange={(e) => handleAmountChange(cat.id, e.target.value)} disabled={isLoading || !selectedFees[cat.id]?.selected} required={selectedFees[cat.id]?.selected} step="0.01" min="0.01"/>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Select fees and specify the amount to be assigned as 'Pending' to the student's account.</p>
                    </div>
                  )}
                   {allFeeCategories.length === 0 && (<p className="text-xs text-muted-foreground mt-1 pl-6">No fee categories are defined for this school.</p>)}
                </div>
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
