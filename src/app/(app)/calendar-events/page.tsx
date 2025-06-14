
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEvent, UserRole } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const MOCK_CALENDAR_EVENTS_KEY = 'mockCalendarEventsData';

export default function CalendarEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  
  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem('currentUserRole') as UserRole | null;
      setCurrentUserRole(storedRole);

      const storedEvents = localStorage.getItem(MOCK_CALENDAR_EVENTS_KEY);
      if (storedEvents) {
        const parsedEvents: CalendarEvent[] = JSON.parse(storedEvents).map((ev:any) => ({
            ...ev,
            // date: parseISO(ev.date) // Keep as string from localStorage
        }));
        setEvents(parsedEvents);
      } else {
        // Initialize with some default events if none are stored
        const initialEvents = [
          { id: '1', title: 'School Assembly', date: format(new Date(2024, 6, 20), 'yyyy-MM-dd'), isAllDay: false, startTime: '09:00', endTime: '10:00', description: 'All students to attend.' },
          { id: '2', title: 'Parent-Teacher Meeting', date: format(new Date(2024, 6, 25), 'yyyy-MM-dd'), isAllDay: true, description: 'Meetings throughout the day.' },
        ];
        setEvents(initialEvents);
        localStorage.setItem(MOCK_CALENDAR_EVENTS_KEY, JSON.stringify(initialEvents));
      }
    }
  }, []);

  const updateLocalStorage = (updatedEvents: CalendarEvent[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_CALENDAR_EVENTS_KEY, JSON.stringify(updatedEvents));
    }
  };

  const resetForm = () => {
    setEventTitle('');
    setEventDate(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setEventIsAllDay(false);
    setEventStartTime('');
    setEventEndTime('');
    setEventDescription('');
    setEditingEvent(null);
  };

  const handleOpenFormDialog = (eventToEdit?: CalendarEvent) => {
    if (currentUserRole === 'student') return; // Students cannot open form
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setEventTitle(eventToEdit.title);
      setEventDate(eventToEdit.date); 
      setEventIsAllDay(eventToEdit.isAllDay);
      setEventStartTime(eventToEdit.startTime || '');
      setEventEndTime(eventToEdit.endTime || '');
      setEventDescription(eventToEdit.description || '');
    } else {
      resetForm();
      if (selectedDate) {
        setEventDate(format(selectedDate, 'yyyy-MM-dd'));
      }
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmitEvent = (e: FormEvent) => {
    e.preventDefault();
    if (currentUserRole === 'student') return; 

    if (!eventTitle.trim() || !eventDate) {
      toast({ title: "Error", description: "Event Title and Date are required.", variant: "destructive" });
      return;
    }

    let updatedEvents;
    if (editingEvent) {
      updatedEvents = events.map(event => 
        event.id === editingEvent.id ? { 
          ...event, 
          title: eventTitle.trim(),
          date: eventDate,
          isAllDay: eventIsAllDay,
          startTime: eventIsAllDay ? undefined : eventStartTime,
          endTime: eventIsAllDay ? undefined : eventEndTime,
          description: eventDescription.trim() || undefined,
        } : event
      );
      toast({ title: "Event Updated", description: "The event has been successfully updated."});
    } else {
      const newEventToAdd: CalendarEvent = {
        id: String(Date.now()),
        title: eventTitle.trim(),
        date: eventDate,
        isAllDay: eventIsAllDay,
        startTime: eventIsAllDay ? undefined : eventStartTime,
        endTime: eventIsAllDay ? undefined : eventEndTime,
        description: eventDescription.trim() || undefined,
      };
      updatedEvents = [...events, newEventToAdd];
      toast({ title: "Event Added", description: "The new event has been added to the calendar."});
    }
    
    updatedEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setEvents(updatedEvents);
    updateLocalStorage(updatedEvents);
    setIsFormDialogOpen(false);
    resetForm();
  };

  const handleDeleteEvent = (id: string) => {
    if (currentUserRole === 'student') return; 
    if (confirm("Are you sure you want to delete this event?")) {
      const updatedEvents = events.filter(event => event.id !== id);
      setEvents(updatedEvents);
      updateLocalStorage(updatedEvents);
      toast({ title: "Event Deleted", variant: "destructive" });
    }
  };

  const eventsOnSelectedDate = selectedDate 
    ? events.filter(event => {
        // Compare dates by parsing them first to avoid timezone issues with direct string comparison
        const eventDateObj = parseISO(event.date);
        return isValid(eventDateObj) && format(eventDateObj, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      })
    : [];

  const canManageEvents = currentUserRole !== 'student';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Calendar & Events" 
        description="Organize and view school events and activities. Events are saved locally."
        actions={
          canManageEvents ? (
            <Button onClick={() => handleOpenFormDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Event
            </Button>
          ) : null
        }
      />

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
            <Card>
                <CardHeader><CardTitle>Calendar</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                            setSelectedDate(date);
                            if(date && canManageEvents) setEventDate(format(date, 'yyyy-MM-dd'));
                        }}
                        className="rounded-md border"
                        initialFocus
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
            <CardContent className="space-y-4 max-h-[calc(theme(space.96)_*_2)] overflow-y-auto">
              {eventsOnSelectedDate.length > 0 ? eventsOnSelectedDate.map(event => (
                <Card key={event.id} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <CardDescription>
                          {event.isAllDay ? 'All Day' : `${event.startTime || ''}${event.startTime && event.endTime ? ' - ' : ''}${event.endTime || ''}`}
                        </CardDescription>
                      </div>
                      {canManageEvents && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(event)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteEvent(event.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  {event.description && (
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                    </CardContent>
                  )}
                </Card>
              )) : (
                <p className="text-muted-foreground text-center py-4">No events scheduled for this day.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {canManageEvents && (
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitEvent}>
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="eventTitle">Event Title</Label>
                  <Input id="eventTitle" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event Title" required />
                </div>
                <div>
                  <Label htmlFor="eventDate">Date</Label>
                  <Input type="date" id="eventDate" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="eventIsAllDay" checked={eventIsAllDay} onCheckedChange={(checked) => setEventIsAllDay(!!checked)} />
                  <Label htmlFor="eventIsAllDay">All-day event</Label>
                </div>
                {!eventIsAllDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eventStartTime">Start Time</Label>
                      <Input id="eventStartTime" type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="eventEndTime">End Time</Label>
                      <Input id="eventEndTime" type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="eventDescription">Description (Optional)</Label>
                  <Textarea id="eventDescription" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Event details..." />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingEvent ? 'Save Changes' : 'Add Event'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
