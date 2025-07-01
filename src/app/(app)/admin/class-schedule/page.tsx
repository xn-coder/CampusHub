
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClassScheduleDB as ClassScheduleItem, ClassData, Subject, Teacher, DayOfWeek as DayOfWeekType, User } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Clock, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { addClassScheduleAction, updateClassScheduleAction, deleteClassScheduleAction, fetchClassSchedulePageData } from './actions';
import { supabase } from '@/lib/supabaseClient'; // For fetching current user's school ID

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school for class schedule:", error?.message);
    return null;
  }
  return school.id;
}

export default function ClassSchedulePage() {
  const { toast } = useToast();
  const [scheduleItems, setScheduleItems] = useState<ClassScheduleItem[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClassScheduleItem | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekType>('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      fetchAdminSchoolId(adminUserId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          loadPageData(schoolId);
        } else {
          toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast]);

  async function loadPageData(schoolId: string) {
    setIsLoading(true);
    const result = await fetchClassSchedulePageData(schoolId);
    if (result.ok) {
      setScheduleItems(result.schedules || []);
      setActiveClasses(result.activeClasses || []);
      setSubjects(result.subjects || []);
      setTeachers(result.teachers || []);
    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }

  const resetForm = () => {
    setSelectedClassId(''); setSelectedSubjectId(''); setSelectedTeacherId('');
    setDayOfWeek('Monday'); setStartTime(''); setEndTime('');
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: ClassScheduleItem) => {
    if (item) {
      setEditingItem(item);
      setSelectedClassId(item.class_id);
      setSelectedSubjectId(item.subject_id);
      setSelectedTeacherId(item.teacher_id);
      setDayOfWeek(item.day_of_week as DayOfWeekType);
      setStartTime(item.start_time);
      setEndTime(item.end_time);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentSchoolId || !selectedClassId || !selectedSubjectId || !selectedTeacherId || !dayOfWeek || !startTime || !endTime) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const scheduleData = {
      school_id: currentSchoolId,
      class_id: selectedClassId,
      subject_id: selectedSubjectId,
      teacher_id: selectedTeacherId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    };

    let result;
    if (editingItem) {
      result = await updateClassScheduleAction(editingItem.id, scheduleData);
    } else {
      result = await addClassScheduleAction(scheduleData);
    }
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: editingItem ? "Schedule Updated" : "Schedule Added", description: result.message });
      if (currentSchoolId) loadPageData(currentSchoolId); // Re-fetch
      setIsDialogOpen(false);
      resetForm();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };
  
  const handleDeleteItem = async (itemId: string) => {
    if (!currentSchoolId) return;
    if (confirm("Are you sure you want to delete this schedule item?")) {
      setIsSubmitting(true);
      const result = await deleteClassScheduleAction(itemId, currentSchoolId);
      setIsSubmitting(false);
      if (result.ok) {
        toast({ title: "Schedule Item Deleted", variant: "destructive" });
        if (currentSchoolId) loadPageData(currentSchoolId); // Re-fetch
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    }
  };

  const daysOfWeekList: DayOfWeekType[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Helper to get names from IDs for display
  const getClassName = (id: string) => activeClasses.find(c => c.id === id)?.name || 'N/A';
  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || 'N/A';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'N/A';


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class Schedule Management" 
        description="Define and manage class schedules for the school."
        actions={
          <Button onClick={() => handleOpenDialog()} disabled={isLoading || isSubmitting || !currentSchoolId}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Schedule Item
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Current Class Schedules</CardTitle>
          <CardDescription>List of all planned class schedules.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
           !currentSchoolId ? <p className="text-destructive text-center py-4">Admin not associated with a school.</p> :
           scheduleItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No class schedules defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{(item.class as ClassData)?.name || getClassName(item.class_id)} - {(item.class as ClassData)?.division}</TableCell>
                    <TableCell>{(item.subject as Subject)?.name || getSubjectName(item.subject_id)}</TableCell>
                    <TableCell>{(item.teacher as Teacher)?.name || getTeacherName(item.teacher_id)}</TableCell>
                    <TableCell>{item.day_of_week}</TableCell>
                    <TableCell>{item.start_time} - {item.end_time}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(item)} disabled={isSubmitting}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Clock className="mr-2 h-5 w-5" /> {editingItem ? 'Edit' : 'Add New'} Class Schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div>
                <Label htmlFor="classId">Class</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{activeClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subjectId">Subject</Label>
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="teacherId">Teacher</Label>
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dayOfWeek">Day of Week</Label>
                <Select value={dayOfWeek} onValueChange={(val) => setDayOfWeek(val as DayOfWeekType)} required disabled={isSubmitting}>
                  <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                  <SelectContent>{daysOfWeekList.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required disabled={isSubmitting}/>
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required disabled={isSubmitting}/>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} 
                {editingItem ? 'Save Changes' : 'Add Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
