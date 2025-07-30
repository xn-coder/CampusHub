
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Student, User, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, School, Loader2, UserCog, Save, UploadCloud } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { updateStudentProfileAction } from './actions';
import { updateUserPasswordAction } from '@/actions/userActions';

export default function StudentProfilePage() {
  const { toast } = useToast();
  const [studentDetails, setStudentDetails] = useState<Student | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [classDetails, setClassDetails] = useState<ClassData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  // Edit form state
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editFatherOccupation, setEditFatherOccupation] = useState('');
  const [editMotherName, setEditMotherName] = useState('');
  const [editMotherOccupation, setEditMotherOccupation] = useState('');
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editParentContactNumber, setEditParentContactNumber] = useState('');
  const [editProfilePictureFile, setEditProfilePictureFile] = useState<File | null>(null);
  
  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchProfileData = useCallback(async () => {
    setIsLoading(true);
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
      toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', currentUserId).single();
      if (userError || !userData) throw userError || new Error("User data not found.");
      setUserDetails(userData as User);

      const { data: studentData, error: studentError } = await supabase.from('students').select('*').eq('user_id', currentUserId).single();
      if (studentError || !studentData) throw studentError || new Error("Student profile not found.");
      setStudentDetails(studentData as Student);
      
      // Pre-fill edit form state
      setEditContactNumber(studentData.contact_number || '');
      setEditAddress(studentData.address || '');
      setEditBloodGroup(studentData.blood_group || '');
      setEditFatherName(studentData.father_name || '');
      setEditFatherOccupation(studentData.father_occupation || '');
      setEditMotherName(studentData.mother_name || '');
      setEditMotherOccupation(studentData.mother_occupation || '');
      setEditGuardianName(studentData.guardian_name || '');
      setEditParentContactNumber(studentData.parent_contact_number || '');

      if (studentData.class_id) {
        const { data: classData, error: classError } = await supabase.from('classes').select('*').eq('id', studentData.class_id).single();
        if (classError) console.warn("Could not fetch class details:", classError?.message);
        else setClassDetails(classData as ClassData);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentDetails || !userDetails) {
      toast({ title: "Error", description: "Profile context is missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('studentId', studentDetails.id);
    formData.append('userId', userDetails.id);
    formData.append('contactNumber', editContactNumber);
    formData.append('address', editAddress);
    formData.append('bloodGroup', editBloodGroup);
    formData.append('fatherName', editFatherName);
    formData.append('fatherOccupation', editFatherOccupation);
    formData.append('motherName', editMotherName);
    formData.append('motherOccupation', editMotherOccupation);
    formData.append('guardianName', editGuardianName);
    formData.append('parentContactNumber', editParentContactNumber);
    if (editProfilePictureFile) {
      formData.append('profilePictureFile', editProfilePictureFile);
    }

    const result = await updateStudentProfileAction(formData);
    
    if (result.ok) {
      toast({ title: "Profile Updated", description: result.message });
      setIsEditDialogOpen(false);
      await fetchProfileData(); 
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
        toast({title: "Error", description: "Passwords do not match.", variant: "destructive"});
        return;
    }
    if (!userDetails?.id) {
        toast({title: "Error", description: "User session not found.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await updateUserPasswordAction(userDetails.id, newPassword);
    if (result.ok) {
        toast({title: "Success", description: "Password updated successfully."});
        setIsPasswordDialogOpen(false);
        setNewPassword('');
        setConfirmPassword('');
    } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
    }
    setIsSubmitting(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File too large", description: "Profile picture should be less than 2MB.", variant: "destructive" });
      setEditProfilePictureFile(null);
      e.target.value = '';
      return;
    }
    setEditProfilePictureFile(file);
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
        <Card><CardContent className="pt-6"><p className="text-destructive text-center">Could not load your profile data.</p></CardContent></Card>
      </div>
    );
  }
  
  const classDisplayText = classDetails ? `${classDetails.name} - ${classDetails.division}` : 'Not Assigned';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and update your personal information." 
        actions={
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserCog className="mr-2 h-4 w-4"/> Edit Profile</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Your Profile</DialogTitle>
                <DialogDescription>Make changes to your editable profile details below. Click save when you're done.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit}>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-4">
                  <h4 className="font-semibold text-lg border-b pb-2">Personal & Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="profilePictureFile">Profile Picture (Optional, &lt;2MB)</Label>
                        <Input id="profilePictureFile" type="file" onChange={handleFileChange} accept="image/png, image/jpeg" disabled={isSubmitting}/>
                    </div>
                    <div>
                        <Label htmlFor="editContactNumber">Your Contact Number</Label>
                        <Input id="editContactNumber" type="tel" value={editContactNumber} onChange={(e) => setEditContactNumber(e.target.value)} disabled={isSubmitting}/>
                    </div>
                    <div>
                        <Label htmlFor="editBloodGroup">Blood Group</Label>
                        <Select value={editBloodGroup} onValueChange={setEditBloodGroup} disabled={isSubmitting}>
                            <SelectTrigger id="editBloodGroup"><SelectValue placeholder="Select blood group" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem>
                                <SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem>
                                <SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem>
                                <SelectItem value="O+">O+</SelectItem><SelectItem value="O-">O-</SelectItem>
                                <SelectItem value="Unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Label htmlFor="editAddress">Full Address</Label>
                        <Textarea id="editAddress" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} disabled={isSubmitting}/>
                    </div>
                  </div>
                  
                  <h4 className="font-semibold text-lg border-b pb-2 pt-4">Parent/Guardian Information</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="editFatherName">Father's Name</Label>
                            <Input id="editFatherName" value={editFatherName} onChange={(e) => setEditFatherName(e.target.value)} disabled={isSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="editFatherOccupation">Father's Occupation</Label>
                            <Input id="editFatherOccupation" value={editFatherOccupation} onChange={(e) => setEditFatherOccupation(e.target.value)} disabled={isSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="editMotherName">Mother's Name</Label>
                            <Input id="editMotherName" value={editMotherName} onChange={(e) => setEditMotherName(e.target.value)} disabled={isSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="editMotherOccupation">Mother's Occupation</Label>
                            <Input id="editMotherOccupation" value={editMotherOccupation} onChange={(e) => setEditMotherOccupation(e.target.value)} disabled={isSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="editGuardianName">Guardian's Name</Label>
                            <Input id="editGuardianName" value={editGuardianName} onChange={(e) => setEditGuardianName(e.target.value)} disabled={isSubmitting}/>
                        </div>
                        <div>
                            <Label htmlFor="editParentContactNumber">Parent/Guardian Contact</Label>
                            <Input id="editParentContactNumber" type="tel" value={editParentContactNumber} onChange={(e) => setEditParentContactNumber(e.target.value)} disabled={isSubmitting}/>
                        </div>
                   </div>

                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
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
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full"><KeyRound className="mr-2 h-4 w-4" /> Reset Password</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reset Your Password</DialogTitle></DialogHeader>
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="space-y-4 py-4">
                            <div><Label htmlFor="newPassword">New Password</Label><Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="confirmPassword">Confirm New Password</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSubmitting}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting || newPassword.length < 6 || newPassword !== confirmPassword}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Set New Password
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Full Name</Label><Input value={studentDetails.name} readOnly disabled /></div>
            <div><Label>Roll Number</Label><Input value={studentDetails.roll_number || 'N/A'} readOnly disabled /></div>
            <div><Label>Email</Label><Input type="email" value={userDetails.email} readOnly disabled /></div>
            <div><Label>Date of Birth</Label><Input value={studentDetails.date_of_birth || 'N/A'} readOnly disabled /></div>
            <div><Label>Gender</Label><Input value={studentDetails.gender || 'N/A'} readOnly disabled /></div>
            <div><Label>Nationality</Label><Input value={studentDetails.nationality || 'N/A'} readOnly disabled /></div>
            <div><Label>Your Contact Number</Label><Input value={studentDetails.contact_number || 'N/A'} readOnly disabled /></div>
            <div><Label>Blood Group</Label><Input value={studentDetails.blood_group || 'N/A'} readOnly disabled /></div>
            <div className="md:col-span-2"><Label>Address</Label><Textarea value={studentDetails.address || 'N/A'} readOnly disabled /></div>
            <hr className="md:col-span-2"/>
            <h4 className="md:col-span-2 text-lg font-medium">Parent/Guardian Details</h4>
            <div><Label>Father's Name</Label><Input value={studentDetails.father_name || 'N/A'} readOnly disabled /></div>
            <div><Label>Father's Occupation</Label><Input value={studentDetails.father_occupation || 'N/A'} readOnly disabled /></div>
            <div><Label>Mother's Name</Label><Input value={studentDetails.mother_name || 'N/A'} readOnly disabled /></div>
            <div><Label>Mother's Occupation</Label><Input value={studentDetails.mother_occupation || 'N/A'} readOnly disabled /></div>
            <div><Label>Guardian's Name</Label><Input value={studentDetails.guardian_name || 'N/A'} readOnly disabled /></div>
            <div><Label>Parent/Guardian Contact</Label><Input value={studentDetails.parent_contact_number || 'N/A'} readOnly disabled /></div>
            <div><Label>Annual Family Income</Label><Input value={studentDetails.annual_family_income?.toString() || 'N/A'} readOnly disabled /></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
