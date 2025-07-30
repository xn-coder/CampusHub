
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEventDB as CalendarEvent, UserRole, User } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Loader2, MoreHorizontal } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { addCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction, getCalendarEventsAction } from './actions';
import { supabase } from '@/lib/supabaseClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function CalendarEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventDates, setEventDates] = useState<Date[]>([]); // For highlighting dates
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(true);

  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null); 

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventIsAllDay, setEventIsAllDay] = useState(false);
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  useEffect(() => {
    async function loadUserContextAndEvents() {
      setIsContextLoading(true);
      let role: UserRole | null = null;
      let userId: string | null = null;
      let fetchedSchoolId: string | null = null;
      let fetchedUserName: string | null = null;

      setSelectedDate(new Date()); // Set date on client mount
      setEventDate(format(new Date(), 'yyyy-MM-dd'));

      if (typeof window !== 'undefined') {
        role = localStorage.getItem('currentUserRole') as UserRole | null;
        userId = localStorage.getItem('currentUserId');
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId) {
          const { data: userRec, error: userErr } = await supabase
            .from('users')
            .select('school_id, name')
            .eq('id', userId)
            .single();
          
          if (!userRec && !userErr) { 
            if (role !== 'superadmin') {
              toast({title: "Authentication Error", description: "User profile not found. Please log in again.", variant: "destructive"});
            }
            fetchedSchoolId = null;
          } else if (userErr) { 
            if (role !== 'superadmin') {
              toast({title: "Context Error", description: `Failed to load user details: ${userErr.message}`, variant: "destructive"});
            }
            fetchedSchoolId = null;
          } else { 
            fetchedSchoolId = userRec.school_id;
            fetchedUserName = userRec.name;
            setCurrentUserName(userRec.name);


            if (role === 'admin' && userRec && !fetchedSchoolId) {
              console.log("[Calendar Page] Admin user's users.school_id is null. Attempting fallback via schools.admin_user_id for user ID:", userId);
              const { data: schoolDataFoundByAdminLink, error: schoolFetchErrorOnFallback } = await supabase
                .from('schools')
                .select('id')
                .eq('admin_user_id', userId) 
                .single();
              
              if (schoolFetchErrorOnFallback && schoolFetchErrorOnFallback.code !== 'PGRST116') { 
                console.error("[Calendar Page] Error during admin_user_id fallback query:", schoolFetchErrorOnFallback.message);
              } else if (schoolDataFoundByAdminLink) {
                console.log("[Calendar Page] Fallback successful. Found school ID via schools.admin_user_id:", schoolDataFoundByAdminLink.id);
                fetchedSchoolId = schoolDataFoundByAdminLink.id; 
              } else {
                console.log("[Calendar Page] Fallback for admin failed. No school found where this user is admin_user_id.");
              }
            }
          }
          
          setCurrentSchoolId(fetchedSchoolId);

        } else { 
          fetchedSchoolId = null;
          setCurrentSchoolId(null);
          if (role !== null) { 
             toast({ title: "Context Missing", description: "User ID not found. Cannot load calendar.", variant: "destructive"});
          }
        }
      }
      setIsContextLoading(false); 
    }
    loadUserContextAndEvents();
  }, [toast]);

  useEffect(() => {
    async function fetchEventsForSchool() {
      if (isContextLoading || !currentUserRole) return; 

      if (!currentSchoolId && currentUserRole !== 'superadmin') {
        setIsLoading(false); 
        setEvents([]);
        setEventDates([]);
        return;
      }
      if (currentUserRole === 'superadmin' && !currentSchoolId) {
         setIsLoading(false); 
         setEvents([]);
         setEventDates([]);
         return;
      }
      if (!currentSchoolId) {
        setIsLoading(false);
        setEvents([]);
        setEventDates([]);
        return;
      }

      setIsLoading(true);
      const result = await getCalendarEventsAction(currentSchoolId, currentUserId!, currentUserRole);
      if (result.ok && result.events) {
        setEvents(result.events);
        const datesWithEvents = result.events
          .map(event => parseISO(event.date))
          .filter(date => isValid(date));
        setEventDates(datesWithEvents);
      } else {
        toast({ title: "Error", description: result.message || "Failed to fetch calendar events.", variant: "destructive" });
        setEvents([]);
        setEventDates([]);
      }
      setIsLoading(false);
    }

    fetchEventsForSchool();
  }, [currentSchoolId, currentUserId, currentUserRole, isContextLoading, toast]);


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
    if (currentUserRole === 'student' || (currentUserRole === 'superadmin' && !currentSchoolId)) {
        toast({ title: "Permission Denied", description: "You do not have permission to add or edit events.", variant: "destructive"});
        return;
    }
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
    if (!currentSchoolId || !currentUserId || !currentUserRole) {
      toast({ title: "Error", description: "Action not permitted or missing context.", variant: "destructive" });
      return;
    }
    if (currentUserRole === 'superadmin' && !currentSchoolId){ 
        toast({ title: "Error", description: "Superadmin must have a school context to post events.", variant: "destructive" });
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
      posted_by_user_id: currentUserId,
    };

    if (editingEvent) {
      result = await updateCalendarEventAction(editingEvent.id, eventData as any);
    } else {
      result = await addCalendarEventAction(eventData);
    }
    setIsSubmitting(false);

    if (result.ok) {
      toast({
        title: editingEvent ? "Event Updated" : "Event Added",
        description: `${result.message}`
      });
      if (currentSchoolId && currentUserId && currentUserRole) {
         const fetchResult = await getCalendarEventsAction(currentSchoolId, currentUserId, currentUserRole);
         if (fetchResult.ok && fetchResult.events) {
            setEvents(fetchResult.events);
            const datesWithEvents = fetchResult.events
              .map(event => parseISO(event.date))
              .filter(date => isValid(date));
            setEventDates(datesWithEvents);
         }
      }
      setIsFormDialogOpen(false);
      resetForm();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (currentUserRole === 'student' || !currentSchoolId || (currentUserRole === 'superadmin' && !currentSchoolId) ) {
        toast({title: "Error", description: "Action not permitted.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const result = await deleteCalendarEventAction(id, currentSchoolId);
    setIsSubmitting(false);
    if (result.ok) {
      toast({ title: "Event Deleted", variant: "destructive" });
        if (currentSchoolId && currentUserId && currentUserRole) {
          const fetchResult = await getCalendarEventsAction(currentSchoolId, currentUserId, currentUserRole);
          if (fetchResult.ok && fetchResult.events) {
              setEvents(fetchResult.events);
              const datesWithEvents = fetchResult.events
                .map(event => parseISO(event.date))
                .filter(date => isValid(date));
              setEventDates(datesWithEvents);
          }
      }
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const eventsOnSelectedDate = selectedDate
    ? events.filter(event => {
        const eventDateObj = parseISO(event.date);
        return isValid(eventDateObj) && format(eventDateObj, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      })
    : [];
    
  const calendarModifiers = {
    hasEvents: eventDates,
  };

  const canManageEvents = (currentUserRole === 'admin' || currentUserRole === 'teacher') && !!currentSchoolId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar & Events"
        description="Organize and view school events and activities."
        actions={
          canManageEvents ? (
            <Button onClick={() => handleOpenFormDialog()} disabled={isSubmitting || isContextLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Event
            </Button>
          ) : null
        }
      />

      {isContextLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block"/> Loading user context...</CardContent></Card>}
      
      {!isContextLoading && !currentSchoolId && currentUserRole !== 'superadmin' && (
        <Card><CardContent className="pt-6 text-center text-destructive">Cannot load calendar. User is not associated with a school or school context is missing.</CardContent></Card>
      )}
      {!isContextLoading && currentUserRole === 'superadmin' && !currentSchoolId && (
         <Card><CardContent className="pt-6 text-center text-muted-foreground">Superadmin: No specific school selected. Calendar events are school-specific. Select a school context or create events via school admin panel.</CardContent></Card>
      )}

      {!isContextLoading && currentSchoolId && (
        <>
          {isLoading && <Card><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline-block"/> Loading calendar data...</CardContent></Card>}
          {!isLoading && (
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
                              disabled={isSubmitting || !currentSchoolId}
                              modifiers={calendarModifiers}
                              modifiersClassNames={{ hasEvents: 'rdp-day_hasEvents' }}
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
                                {event.is_all_day ? 'All Day' : `${event.start_time || ''}${event.start_time && event.end_time ? ' - ' : ''}${event.end_time || ''}`}
                              </CardDescription>
                              <CardDescription className="text-xs">
                                Posted by: {event.posted_by_user?.name || 'Unknown User'} ({event.posted_by_user?.role || 'N/A'})
                              </CardDescription>
                            </div>
                            {canManageEvents && (
                               <AlertDialog>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => handleOpenFormDialog(event)}>
                                          <Edit2 className="mr-2 h-4 w-4" /> Edit
                                      </DropdownMenuItem>
                                      <AlertDialogTrigger asChild>
                                          <DropdownMenuItem className="text-destructive">
                                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                                          </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                      <AlertDialogDescription>This action cannot be undone. This will permanently delete the event "{event.title}".</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteEvent(event.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
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
                      <p className="text-muted-foreground text-center py-4">
                        No events scheduled for this day.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
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
