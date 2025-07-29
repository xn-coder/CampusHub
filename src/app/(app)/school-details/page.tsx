
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState, type ChangeEvent, useEffect, type FormEvent } from 'react';
import type { SchoolDetails, Holiday, UserRole } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Trash2, Loader2, Save, Ban, UploadCloud } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getSchoolDetailsAndHolidaysAction, updateSchoolDetailsAction, addHolidayAction, deleteHolidayAction } from './actions';
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
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>(new Date());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
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
        const result = await getSchoolDetailsAndHolidaysAction(schoolId);
        if (result.ok) {
          setSchoolDetails(result.details || {});
          setHolidays((result.holidays || []).map(h => ({ ...h, date: new Date(h.date.replace(/-/g, '\/')) })));
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
            const freshData = await getSchoolDetailsAndHolidaysAction(currentSchoolId);
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

  const handleAddHoliday = async () => {
    if (!newHolidayName || !newHolidayDate || !isValid(newHolidayDate) || !currentSchoolId) {
      toast({ title: "Error", description: "Please provide a valid name and date.", variant: "destructive" });
      return;
    }
    setIsSubmittingHoliday(true);
    const result = await addHolidayAction({
      name: newHolidayName,
      date: format(newHolidayDate, 'yyyy-MM-dd'),
      school_id: currentSchoolId,
    });

    if (result.ok) {
      toast({ title: "Holiday Added", description: result.message });
      setNewHolidayName('');
      setNewHolidayDate(new Date());
      // Re-fetch holidays
      const holidaysRes = await getSchoolDetailsAndHolidaysAction(currentSchoolId);
      if (holidaysRes.ok) setHolidays((holidaysRes.holidays || []).map(h => ({ ...h, date: new Date(h.date.replace(/-/g, '\/')) })));
    } else {
       toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingHoliday(false);
  };
  
  const handleRemoveHoliday = async (id: string) => {
    const result = await deleteHolidayAction(id);
    if (result.ok) {
      toast({ title: "Holiday Removed", variant: "destructive" });
      setHolidays(prev => prev.filter(h => h.id !== id));
    } else {
       toast({ title: "Error", description: result.message, variant: "destructive" });
    }
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
      <PageHeader title="School Details" description="Manage school-wide information and holiday schedule." />

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

      <Card>
        <CardHeader>
          <CardTitle>Holiday Schedule</CardTitle>
          <CardDescription>Manage the school's holiday calendar. Newest holidays are listed first.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
                <div>
                    <Label htmlFor="newHolidayName">Holiday Name</Label>
                    <Input id="newHolidayName" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="e.g. Winter Break" />
                </div>
                 <div>
                    <Label>Selected Date: {newHolidayDate ? format(newHolidayDate, 'PPP') : 'None'}</Label>
                    <div className="mt-2">
                        <Button onClick={handleAddHoliday} className="w-full" disabled={isSubmittingHoliday}>
                            {isSubmittingHoliday ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} 
                            Add Holiday
                        </Button>
                    </div>
                 </div>
            </div>
             <div className="md:col-span-1 flex justify-center">
                <Calendar 
                    mode="single" 
                    selected={newHolidayDate} 
                    onSelect={setNewHolidayDate} 
                    className="rounded-md border p-3 inline-block"
                    initialFocus
                />
            </div>
          </div>
          <h4 className="text-lg font-medium mt-6 mb-2">Current Holidays:</h4>
          {isLoading ? (
             <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : holidays.length > 0 ? (
            <ul className="space-y-2">
              {holidays.map(holiday => (
                <li key={holiday.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                  <div>
                    <span className="font-medium">{holiday.name}</span> - <span className="text-sm text-muted-foreground">{format(new Date(holiday.date), "MMMM d, yyyy")}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveHoliday(holiday.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-4">No holidays added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
