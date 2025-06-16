
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEventDB as CalendarEvent, UserRole, User } from '@/types'; // Use CalendarEventDB
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Loader2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction, getCalendarEventsAction } from './actions';
import { supabase } from '@/lib/supabaseClient';

export default function CalendarEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Overall loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  useEffect(() => {
    async function loadUserContextAndEvents() { // Renamed function
      setIsLoading(true);
      let role: UserRole | null = null;
      let userId: string | null = null;
      let schoolId: string | null = null;

      if (typeof window !== 'undefined') {
        role = localStorage.getItem('currentUserRole') as UserRole | null;
        userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId) {
          const { data: userRec, error: userErr } = await supabase
            .from('users')
            .select('school_id')
            .eq('id', userId)
            .single();
          
          if (userErr || !userRec ) {
            if (role !== 'superadmin') {
                 toast({title: "Error", description: "Could not determine user's school context.", variant: "destructive"});
            }
            schoolId = null; // Explicitly set to null
          } else {
            schoolId = userRec.school_id;
          }
          setCurrentSchoolId(schoolId);
        } else {
           toast({ title: "Context Missing", description: "Cannot load calendar without user context.", variant: "destructive"});
           schoolId = null;
           setCurrentSchoolId(null);
        }
      }
      
      // Fetch events only if school context is available, or if superadmin (who might not have a school_id by default)
      if (schoolId) {
        const result = await getCalendarEventsAction(schoolId);
        if (result.ok && result.events) {
          setEvents(result.events);
        } else {
          toast({ title: "Error", description: result.message || "Failed to fetch calendar events.", variant: "destructive" });
          setEvents([]);
        }
      } else if (role === 'superadmin') {
        // Superadmin without specific school context, don't fetch events yet
        setEvents([]);
      } else {
        // Other roles without school context
        setEvents([]);
      }
      setIsLoading(false); // Context and initial event loading done
    }
    loadUserContextAndEvents(); // Call the defined function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // Dependency array, toast is stable


  const fetchEventsForSchool = async () => {
    if (!currentSchoolId) return;
    setIsLoading(true);
    const result = await getCalendarEventsAction(currentSchoolId);
    if (result.ok && result.events) {
      setEvents(result.events);
    } else {
      toast({ title: "Error", description: result.message || "Failed to refresh events.", variant: "destructive" });
    }
    setIsLoading(false);
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
    if (currentUserRole === 'student') return; 
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setEventTitle(eventToEdit.title);
      setEventDate(eventToEdit.date); 
      setEventIsAllDay(eventToEdit.is_all_day);
      setEventStartTime(eventToEdit.start_time || '');
      setEventEndTime(eventToEdit.end_time || '');
      setEventDescription(eventToEdit.description || '');
    } else {
      resetForm();
      if (selectedDate) {
        setEventDate(format(selectedDate, 'yyyy-MM-dd'));
      }
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmitEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (currentUserRole === 'student' || !currentSchoolId || !currentUserId) {
      toast({ title: "Error", description: "Action not permitted or missing context.", variant: "destructive" });
      return;
    }

    if (!eventTitle.trim() || !eventDate) {
      toast({ title: "Error", description: "Event Title and Date are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    let result;
    const eventData = {
      title: eventTitle.trim(),
      date: eventDate,
      is_all_day: eventIsAllDay,
      start_time: eventIsAllDay ? null : eventStartTime || null,
      end_time: eventIsAllDay ? null : eventEndTime || null,
      description: eventDescription.trim() || null,
      school_id: currentSchoolId,
      // posted_by_user_id: currentUserId, // If tracking creator
    };

    if (editingEvent) {
      result = await updateCalendarEventAction(editingEvent.id, eventData);
    } else {
      result = await addCalendarEventAction(eventData);
    }
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: editingEvent ? "Event Updated" : "Event Added", description: result.message });
      fetchEventsForSchool(); 
      setIsFormDialogOpen(false);
      resetForm();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (currentUserRole === 'student' || !currentSchoolId) {
        toast({title: "Error", description: "Action not permitted.", variant: "destructive"});
        return;
    }
    if (confirm("Are you sure you want to delete this event?")) {
      setIsSubmitting(true);
      const result = await deleteCalendarEventAction(id, currentSchoolId);
      setIsSubmitting(false);
      if (result.ok) {
        toast({ title: "Event Deleted", variant: "destructive" });
        fetchEventsForSchool(); 
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    }
  };

  const eventsOnSelectedDate = selectedDate 
    ? events.filter(event => {
        const eventDateObj = parseISO(event.date); 
        return isValid(eventDateObj) && format(eventDateObj, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      })
    : [];

  const canManageEvents = currentUserRole !== 'student' && !!currentSchoolId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Calendar & Events" 
        description="Organize and view school events and activities."
        actions={
          canManageEvents ? (
            <Button onClick={() => handleOpenFormDialog()} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Event
            </Button>
          ) : null
        }
      />
      
      {isLoading && <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin inline-block"/> Loading calendar data...</div>}

      {!isLoading && !currentSchoolId && currentUserRole === 'superadmin' && (
         <Card><CardContent className="pt-6 text-center text-muted-foreground">Superadmin: No specific school selected. Calendar events are school-specific. (Future enhancement: school selector for superadmin)</CardContent></Card>
      )}
      {!isLoading && !currentSchoolId && currentUserRole !== 'superadmin' && currentUserRole !== null && ( // Added currentUserRole !== null to avoid flash of this message during initial load
        <Card><CardContent className="pt-6 text-center text-destructive">Cannot load calendar. User is not associated with a school or school context is missing.</CardContent></Card>
      )}

      {!isLoading && (currentSchoolId || (currentUserRole === 'superadmin' && !currentSchoolId)) && ( 
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
                          disabled={isSubmitting}
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
                {isLoading && currentSchoolId && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin inline-block"/> Loading events...</div>}
                {!isLoading && eventsOnSelectedDate.length > 0 ? eventsOnSelectedDate.map(event => (
                  <Card key={event.id} className="overflow-hidden">
                    <CardHeader className="p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          <CardDescription>
                            {event.is_all_day ? 'All Day' : `${event.start_time || ''}${event.start_time && event.end_time ? ' - ' : ''}${event.end_time || ''}`}
                          </CardDescription>
                        </div>
                        {canManageEvents && (
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(event)} disabled={isSubmitting}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteEvent(event.id)} disabled={isSubmitting}>
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
                )) : !isLoading && (
                  <p className="text-muted-foreground text-center py-4">
                    {currentSchoolId ? 'No events scheduled for this day.' : (currentUserRole === 'superadmin' ? 'Select a school context to view events.' : '')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
                  <Input id="eventTitle" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event Title" required disabled={isSubmitting}/>
                </div>
                <div>
                  <Label htmlFor="eventDate">Date</Label>
                  <Input type="date" id="eventDate" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required disabled={isSubmitting}/>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="eventIsAllDay" checked={eventIsAllDay} onCheckedChange={(checked) => setEventIsAllDay(!!checked)} disabled={isSubmitting}/>
                  <Label htmlFor="eventIsAllDay">All-day event</Label>
                </div>
                {!eventIsAllDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="eventStartTime">Start Time</Label>
                      <Input id="eventStartTime" type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} disabled={isSubmitting}/>
                    </div>
                    <div>
                      <Label htmlFor="eventEndTime">End Time</Label>
                      <Input id="eventEndTime" type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} disabled={isSubmitting}/>
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="eventDescription">Description (Optional)</Label>
                  <Textarea id="eventDescription" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Event details..." disabled={isSubmitting}/>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                  {editingEvent ? 'Save Changes' : 'Add Event'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

