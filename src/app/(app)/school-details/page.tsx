
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState, type ChangeEvent, useEffect, type FormEvent } from 'react';
import type { SchoolDetails, Holiday } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Trash2, Loader2, Save } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getSchoolDetailsAndHolidaysAction, updateSchoolDetailsAction, addHolidayAction, deleteHolidayAction } from './actions';

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

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (!adminUserId) {
        toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
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

  const handleDetailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSchoolDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSchoolDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId || !schoolDetails.name) return;
    setIsSubmittingDetails(true);
    const result = await updateSchoolDetailsAction({
        id: currentSchoolId,
        name: schoolDetails.name,
        address: schoolDetails.address,
        contact_email: schoolDetails.contact_email,
        contact_phone: schoolDetails.contact_phone,
    });
    
    if (result.ok) {
        toast({ title: "School Details Updated", description: result.message });
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


  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="School Details" description="Manage school-wide information and holiday schedule." />

      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>Update the general details for the school.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveSchoolDetails}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">School Name</Label>
                <Input id="name" name="name" value={schoolDetails.name || ''} onChange={handleDetailChange} />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" value={schoolDetails.address || ''} onChange={handleDetailChange} />
              </div>
              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input id="contact_email" name="contact_email" type="email" value={schoolDetails.contact_email || ''} onChange={handleDetailChange} />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input id="contact_phone" name="contact_phone" type="tel" value={schoolDetails.contact_phone || ''} onChange={handleDetailChange} />
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
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <Label htmlFor="newHolidayName">Holiday Name</Label>
                <Input id="newHolidayName" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="e.g. Winter Break" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newHolidayDate">Holiday Date</Label>
                 <Input 
                  type="date" 
                  id="newHolidayDate" 
                  value={newHolidayDate ? format(newHolidayDate, 'yyyy-MM-dd') : ''} 
                  onChange={(e) => {
                    const parsedDate = parseISO(e.target.value);
                    if (isValid(parsedDate)) {
                      setNewHolidayDate(parsedDate);
                    } else {
                      setNewHolidayDate(undefined);
                    }
                  }}
                  className="w-full"
                />
              </div>
              <Button onClick={handleAddHoliday} className="self-end mt-2 md:mt-0" disabled={isSubmittingHoliday}>
                {isSubmittingHoliday ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} 
                Add Holiday
              </Button>
            </div>
             <div className="md:col-span-3 flex justify-center md:justify-start">
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
