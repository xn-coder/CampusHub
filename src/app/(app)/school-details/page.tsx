"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { SchoolDetails, Holiday } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Trash2 } from 'lucide-react';

export default function SchoolDetailsPage() {
  const [schoolDetails, setSchoolDetails] = useState<SchoolDetails>({
    name: 'CampusHub High School',
    address: '123 Education Lane, Knowledgetown, USA 12345',
    contactEmail: 'info@campushubhs.edu',
    contactPhone: '(555) 123-4567',
  });

  const [holidays, setHolidays] = useState<Holiday[]>([
    { id: '1', name: 'Summer Break Starts', date: new Date(2024, 6, 20) },
    { id: '2', name: 'Independence Day', date: new Date(2024, 6, 4) },
  ]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>(new Date());


  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSchoolDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleAddHoliday = () => {
    if (newHolidayName && newHolidayDate) {
      setHolidays(prev => [...prev, { id: String(Date.now()), name: newHolidayName, date: newHolidayDate }]);
      setNewHolidayName('');
      setNewHolidayDate(new Date());
    }
  };
  
  const handleRemoveHoliday = (id: string) => {
    setHolidays(prev => prev.filter(holiday => holiday.id !== id));
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
          <Button>Save School Details</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Schedule</CardTitle>
          <CardDescription>Manage the school's holiday calendar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="newHolidayName">Holiday Name</Label>
                <Input id="newHolidayName" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="e.g. Winter Break" />
              </div>
              <div>
                <Label>Holiday Date</Label>
                <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} className="rounded-md border p-0" />
              </div>
              <Button onClick={handleAddHoliday} className="self-end">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
              </Button>
            </div>
          </div>
          <h4 className="text-lg font-medium mt-6 mb-2">Current Holidays:</h4>
          {holidays.length > 0 ? (
            <ul className="space-y-2">
              {holidays.map(holiday => (
                <li key={holiday.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <span className="font-medium">{holiday.name}</span> - <span className="text-sm text-muted-foreground">{holiday.date.toLocaleDateString()}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveHoliday(holiday.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No holidays added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
