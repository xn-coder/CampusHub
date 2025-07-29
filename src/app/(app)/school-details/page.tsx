
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState, type ChangeEvent, useEffect, type FormEvent } from 'react';
import type { SchoolDetails, UserRole } from '@/types';
import { Loader2, Ban, UploadCloud } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getSchoolDetailsAction, updateSchoolDetailsAction } from './actions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';


async function getAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', adminUserId)
    .single();

  if (error || !user?.school_id) {
    console.error("Error fetching admin's school for details:", error?.message);
    return null;
  }
  return user.school_id;
}


export default function SchoolDetailsPage() {
  const { toast } = useToast();
  const [schoolDetails, setSchoolDetails] = useState<Partial<SchoolDetails>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const adminUserId = localStorage.getItem('currentUserId');
      const role = localStorage.getItem('currentUserRole') as UserRole | null;
      setCurrentUserRole(role);

      if (!adminUserId || (role !== 'admin' && role !== 'superadmin')) {
        setIsLoading(false);
        return;
      }
      
      const schoolId = await getAdminSchoolId(adminUserId);
      setCurrentSchoolId(schoolId);

      if (schoolId) {
        const result = await getSchoolDetailsAction(schoolId);
        if (result.ok) {
          setSchoolDetails(result.details || {});
          if (result.details?.logo_url) {
            setLogoPreview(result.details.logo_url);
          }
        } else {
          toast({ title: "Error", description: result.message || "Failed to load school data.", variant: "destructive" });
        }
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    loadData();
  }, [toast]);

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          toast({ title: "File too large", description: "Logo should be less than 2MB.", variant: "destructive" });
          setLogoFile(null);
          e.target.value = '';
          return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSchoolDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSchoolDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId || !schoolDetails.name) return;
    setIsSubmittingDetails(true);
    
    const formData = new FormData();
    formData.append('id', currentSchoolId);
    if(schoolDetails.name) formData.append('name', schoolDetails.name);
    if(schoolDetails.address) formData.append('address', schoolDetails.address);
    if(schoolDetails.contact_email) formData.append('contact_email', schoolDetails.contact_email);
    if(schoolDetails.contact_phone) formData.append('contact_phone', schoolDetails.contact_phone);
    if(logoFile) formData.append('logoFile', logoFile);

    const result = await updateSchoolDetailsAction(formData);
    
    if (result.ok) {
        toast({ title: "School Details Updated", description: result.message });
        if (currentSchoolId) {
            const freshData = await getSchoolDetailsAction(currentSchoolId);
            if (freshData.ok && freshData.details) {
                setSchoolDetails(freshData.details);
                setLogoPreview(freshData.details.logo_url || null);
            }
        }
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingDetails(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="School Details" />
        <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
                You do not have permission to view or manage school details. This page is for administrators only.
            </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="School Details" description="Manage school-wide information." />

      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>Update the general details and logo for the school.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveSchoolDetails}>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <Label htmlFor="name">School Name</Label>
                    <Input id="name" name="name" value={schoolDetails.name || ''} onChange={handleDetailChange} />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" value={schoolDetails.address || ''} onChange={handleDetailChange} />
                  </div>
                   <div>
                    <Label htmlFor="admin_email">Admin Login Email (Read-only)</Label>
                    <Input id="admin_email" name="admin_email" type="email" value={schoolDetails.admin_email || ''} readOnly disabled />
                  </div>
                </div>
                 <div className="md:col-span-1 space-y-2">
                    <Label>School Logo</Label>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-32 h-32 rounded-lg border border-dashed flex items-center justify-center bg-muted/50">
                            {logoPreview ? (
                                <Image src={logoPreview} alt="School Logo Preview" width={128} height={128} className="object-contain rounded-lg"/>
                            ) : (
                                <span className="text-xs text-muted-foreground">No Logo</span>
                            )}
                        </div>
                        <Label htmlFor="logoFile" className="w-full text-center cursor-pointer text-sm text-primary hover:underline">
                            <UploadCloud className="w-5 h-5 mr-2 inline-block"/>
                            Upload Logo (PNG, JPG &lt;2MB)
                        </Label>
                        <Input id="logoFile" name="logoFile" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleLogoFileChange} />
                    </div>
                 </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="contact_email">Public Contact Email</Label>
                    <Input id="contact_email" name="contact_email" type="email" value={schoolDetails.contact_email || ''} onChange={handleDetailChange} />
                 </div>
                 <div>
                    <Label htmlFor="contact_phone">Public Contact Phone</Label>
                    <Input id="contact_phone" name="contact_phone" type="tel" value={schoolDetails.contact_phone || ''} onChange={handleDetailChange} />
                 </div>
              </div>
              <Button type="submit" disabled={isSubmittingDetails}>
                {isSubmittingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save School Details
              </Button>
            </CardContent>
        </form>
      </Card>
    </div>
  );
}
