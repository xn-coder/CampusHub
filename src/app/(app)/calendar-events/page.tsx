"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEvent } from '@/types';
import { useState } from 'react';
import { PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

const initialEvents: CalendarEvent[] = [
  { id: '1', title: 'Parent-Teacher Meeting', date: new Date(2024, 7, 15), startTime: '16:00', endTime: '18:00', isAllDay: false, description: 'Discuss student progress.' },
  { id: '2', title: 'School Play Rehearsal', date: new Date(2024, 7, 10), startTime: '15:00', endTime: '17:00', isAllDay: false },
  { id: '3', title: 'Book Fair', date: new Date(2024, 7, 20), isAllDay: true, description: 'Annual book fair in the library.' },
];


export default function CalendarEventsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({ title: '', date: selectedDate || new Date(), isAllDay: false });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setNewEvent(prev => ({ ...prev, date: date || new Date() }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
       setNewEvent(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
       setNewEvent(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEvent.title && newEvent.date) {
      const eventToAdd: CalendarEvent = {
        id: String(Date.now()),
        title: newEvent.title,
        date: newEvent.date,
        description: newEvent.description,
        startTime: newEvent.isAllDay ? undefined : newEvent.startTime,
        endTime: newEvent.isAllDay ? undefined : newEvent.endTime,
        isAllDay: !!newEvent.isAllDay,
      };
      setEvents(prev => [...prev, eventToAdd].sort((a,b) => a.date.getTime() - b.date.getTime()));
      setNewEvent({ title: '', date: selectedDate || new Date(), isAllDay: false });
      setShowForm(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  };

  const eventsOnSelectedDate = selectedDate 
    ? events.filter(event => format(event.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Calendar & Events" 
        description="Organize and view school events and activities."
        actions={
          <Button onClick={() => setShowForm(prev => !prev)}>
            <PlusCircle className="mr-2 h-4 w-4" /> {showForm ? 'Cancel' : 'Add Event'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Event</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmitEvent}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" name="title" value={newEvent.title || ''} onChange={handleInputChange} placeholder="Event Title" required />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input type="date" id="date" name="date" value={newEvent.date ? format(newEvent.date, 'yyyy-MM-dd') : ''} onChange={(e) => setNewEvent(prev => ({...prev, date: new Date(e.target.value)}))} required />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isAllDay" name="isAllDay" checked={!!newEvent.isAllDay} onCheckedChange={(checked) => setNewEvent(prev => ({...prev, isAllDay: !!checked}))} />
                <Label htmlFor="isAllDay">All-day event</Label>
              </div>
              {!newEvent.isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input id="startTime" name="startTime" type="time" value={newEvent.startTime || ''} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input id="endTime" name="endTime" type="time" value={newEvent.endTime || ''} onChange={handleInputChange} />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" name="description" value={newEvent.description || ''} onChange={handleInputChange} placeholder="Event details..." />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">Save Event</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
            <Card>
                <CardHeader><CardTitle>Calendar</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        className="rounded-md border"
                    />
                </CardContent>
            </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Events for {selectedDate ? format(selectedDate, "MMMM d, yyyy") : 'Today'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventsOnSelectedDate.length > 0 ? eventsOnSelectedDate.map(event => (
                <Card key={event.id} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <CardDescription>
                          {event.isAllDay ? 'All Day' : `${event.startTime || ''} - ${event.endTime || ''}`}
                        </CardDescription>
                      </div>
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </CardHeader>
                  {event.description && (
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    </CardContent>
                  )}
                </Card>
              )) : (
                <p className="text-muted-foreground">No events scheduled for this day.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
