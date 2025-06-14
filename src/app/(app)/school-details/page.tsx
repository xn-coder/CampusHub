
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState, type ChangeEvent, useEffect } from 'react';
import type { SchoolDetails, Holiday } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Trash2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

const MOCK_SCHOOL_DETAILS_KEY = 'mockSchoolDetails';
const MOCK_HOLIDAYS_KEY = 'mockSchoolHolidays';

export default function SchoolDetailsPage() {
  const { toast } = useToast();
  const [schoolDetails, setSchoolDetails] = useState<SchoolDetails>({
    name: 'CampusHub High School',
    address: '123 Education Lane, Knowledgetown, USA 12345',
    contactEmail: 'info@campushubhs.edu',
    contactPhone: '(555) 123-4567',
  });

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedDetails = localStorage.getItem(MOCK_SCHOOL_DETAILS_KEY);
      if (storedDetails) {
        setSchoolDetails(JSON.parse(storedDetails));
      } else {
        localStorage.setItem(MOCK_SCHOOL_DETAILS_KEY, JSON.stringify(schoolDetails));
      }

      const storedHolidays = localStorage.getItem(MOCK_HOLIDAYS_KEY);
      if (storedHolidays) {
        // Ensure date strings are converted to Date objects
        const parsedHolidays: Holiday[] = JSON.parse(storedHolidays).map((h: any) => ({
          ...h,
          date: new Date(h.date),
        }));
        setHolidays(parsedHolidays.sort((a,b) => b.date.getTime() - a.date.getTime())); // Sort newest first on load
      } else {
         // Initialize with some default holidays if none are stored
        const initialHolidays = [
          { id: '1', name: 'Summer Break Starts', date: new Date(2024, 6, 20) }, // July 20, 2024
          { id: '2', name: 'Independence Day', date: new Date(2024, 6, 4) }, // July 4, 2024
        ].sort((a,b) => b.date.getTime() - a.date.getTime());
        setHolidays(initialHolidays);
        localStorage.setItem(MOCK_HOLIDAYS_KEY, JSON.stringify(initialHolidays));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const updateLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const handleDetailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSchoolDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSchoolDetails = () => {
    updateLocalStorage(MOCK_SCHOOL_DETAILS_KEY, schoolDetails);
    toast({
      title: "School Details Updated",
      description: "The school information has been saved. (In a real system, these changes might require Super Admin approval).",
    });
  };

  const handleAddHoliday = () => {
    if (newHolidayName && newHolidayDate && isValid(newHolidayDate)) {
      const updatedHolidays = [
        { id: String(Date.now()), name: newHolidayName, date: newHolidayDate },
        ...holidays
      ].sort((a,b) => b.date.getTime() - a.date.getTime()); // Ensure newest is always on top after adding
      
      setHolidays(updatedHolidays);
      updateLocalStorage(MOCK_HOLIDAYS_KEY, updatedHolidays);
      setNewHolidayName('');
      setNewHolidayDate(new Date());
      toast({
        title: "Holiday Added",
        description: `${newHolidayName} has been added to the schedule.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Please provide a valid name and date for the holiday.",
        variant: "destructive",
      });
    }
  };
  
  const handleRemoveHoliday = (id: string) => {
    const holidayToRemove = holidays.find(h => h.id === id);
    const updatedHolidays = holidays.filter(holiday => holiday.id !== id);
    setHolidays(updatedHolidays);
    updateLocalStorage(MOCK_HOLIDAYS_KEY, updatedHolidays);
    if (holidayToRemove) {
      toast({
        title: "Holiday Removed",
        description: `${holidayToRemove.name} has been removed from the schedule.`,
        variant: "destructive"
      });
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
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">School Name</Label>
            <Input id="name" name="name" value={schoolDetails.name} onChange={handleDetailChange} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" value={schoolDetails.address} onChange={handleDetailChange} />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" value={schoolDetails.contactEmail} onChange={handleDetailChange} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" name="contactPhone" type="tel" value={schoolDetails.contactPhone} onChange={handleDetailChange} />
          </div>
          <Button onClick={handleSaveSchoolDetails}>Save School Details</Button>
        </CardContent>
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
                      setNewHolidayDate(undefined); // Handle invalid date input
                    }
                  }}
                  className="w-full"
                />
              </div>
              <Button onClick={handleAddHoliday} className="self-end mt-2 md:mt-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
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
          {holidays.length > 0 ? (
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
