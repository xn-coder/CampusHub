
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Teacher, User, Assignment, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, History, BookCheck, ClipboardList, Loader2, UserCog, Save, Briefcase, UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { updateUserPasswordAction } from '@/actions/userActions';
import { getTeacherProfileDataAction, updateTeacherProfileAction } from './actions';

export default function TeacherProfilePage() {
  const { toast } = useToast();
  const [teacherDetails, setTeacherDetails] = useState<Teacher | null>(null);
  const [userDetails, setUserDetails] = useState<User | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  // Edit form state
  const [editSubject, setEditSubject] = useState('');
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

    const result = await getTeacherProfileDataAction(currentUserId);
    
    if(result.ok) {
        setUserDetails(result.user || null);
        setTeacherDetails(result.teacher || null);
        setAssignedClasses(result.classes || []);
        setAssignmentCount(result.assignmentCount || 0);

        if(result.teacher) {
            setEditSubject(result.teacher.subject || '');
        }
    } else {
        toast({ title: "Error", description: result.message || "Failed to load profile data.", variant: "destructive" });
    }
    
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacherDetails || !userDetails) return;
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('teacherId', teacherDetails.id);
    formData.append('userId', userDetails.id);
    formData.append('subject', editSubject);
    if(editProfilePictureFile) {
        formData.append('profilePictureFile', editProfilePictureFile);
    }

    const result = await updateTeacherProfileAction(formData);
    if(result.ok) {
        toast({title: "Profile Updated", description: result.message});
        setIsEditDialogOpen(false);
        await fetchProfileData();
    } else {
        toast({title: "Error", description: result.message, variant: "destructive"});
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
    if(file && file.size > 2 * 1024 * 1024) {
      toast({title: "File too large", description: "Profile picture must be less than 2MB.", variant: "destructive"});
      setEditProfilePictureFile(null);
      e.target.value = '';
      return;
    }
    setEditProfilePictureFile(file);
  };
  
  if (isLoading) {
    return <div className="flex flex-col gap-6"><PageHeader title="My Profile" /><div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin mr-2"/> Loading profile...</div></div>;
  }
  if (!teacherDetails || !userDetails) {
    return <div className="flex flex-col gap-6"><PageHeader title="My Profile" /><Card><CardContent className="pt-6"><p className="text-destructive text-center">Could not load your profile data.</p></CardContent></Card></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and manage your personal and professional information." 
        actions={
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild><Button><UserCog className="mr-2 h-4 w-4"/> Edit Profile</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Your Profile</DialogTitle></DialogHeader>
                    <form onSubmit={handleEditSubmit}>
                        <div className="space-y-4 py-4">
                            <div><Label htmlFor="profilePictureFile">Profile Picture (Optional, &lt;2MB)</Label><Input id="profilePictureFile" type="file" onChange={handleFileChange} accept="image/png, image/jpeg" disabled={isSubmitting}/></div>
                            <div><Label htmlFor="editSubject">Primary Subject</Label><Input id="editSubject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} disabled={isSubmitting}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        }
      />
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="w-24 h-24 mb-4"><AvatarImage src={teacherDetails.profile_picture_url || undefined} alt={teacherDetails.name} data-ai-hint="person teacher" /><AvatarFallback className="text-3xl">{teacherDetails.name.substring(0,2).toUpperCase()}</AvatarFallback></Avatar>
            <CardTitle>{teacherDetails.name}</CardTitle>
            <CardDescription>{userDetails.email}</CardDescription>
            <CardDescription>Role: {userDetails.role}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild><Button variant="outline" className="w-full"><KeyRound className="mr-2 h-4 w-4" /> Reset Password</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reset Your Password</DialogTitle></DialogHeader>
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="space-y-4 py-4">
                            <div><Label htmlFor="newPassword">New Password</Label><Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={isSubmitting}/></div>
                            <div><Label htmlFor="confirmPassword">Confirm New Password</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSubmitting}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting || newPassword.length < 6 || newPassword !== confirmPassword}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Set New Password</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Academic History & Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><h4 className="font-semibold flex items-center"><Briefcase className="mr-2 h-4 w-4 text-primary"/>Current Classes Taught:</h4>
                {assignedClasses.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {assignedClasses.map(cls => <li key={cls.id}>{cls.name} - {cls.division}</li>)}
                    </ul>
                ) : <p className="text-sm text-muted-foreground">Not assigned to any classes.</p>}
            </div>
            <div><h4 className="font-semibold flex items-center"><ClipboardList className="mr-2 h-4 w-4 text-primary"/>Assignments Posted:</h4><p className="text-sm text-muted-foreground">{assignmentCount} assignment(s) recorded in the system.</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
