
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClassScheduleItem } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Clock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const MOCK_CLASS_SCHEDULES_KEY = 'mockClassSchedulesData';

export default function ClassSchedulePage() {
  const { toast } = useToast();
  const [scheduleItems, setScheduleItems] = useState<ClassScheduleItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ClassScheduleItem> | null>(null);

  // Form state
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'>('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSchedules = localStorage.getItem(MOCK_CLASS_SCHEDULES_KEY);
      if (storedSchedules) {
        setScheduleItems(JSON.parse(storedSchedules));
      }
    }
  }, []);

  const updateLocalStorage = (data: ClassScheduleItem[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_CLASS_SCHEDULES_KEY, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setClassName('');
    setSubject('');
    setTeacherName('');
    setDayOfWeek('Monday');
    setStartTime('');
    setEndTime('');
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: ClassScheduleItem) => {
    if (item) {
      setEditingItem(item);
      setClassName(item.className);
      setSubject(item.subject);
      setTeacherName(item.teacherName);
      setDayOfWeek(item.dayOfWeek);
      setStartTime(item.startTime);
      setEndTime(item.endTime);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!className || !subject || !teacherName || !dayOfWeek || !startTime || !endTime) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }

    let updatedSchedules;
    if (editingItem && editingItem.id) {
      updatedSchedules = scheduleItems.map(item =>
        item.id === editingItem.id ? { ...item, className, subject, teacherName, dayOfWeek, startTime, endTime } : item
      );
      toast({ title: "Schedule Updated", description: `Schedule for ${className} on ${dayOfWeek} updated.` });
    } else {
      const newItem: ClassScheduleItem = {
        id: `cs-${Date.now()}`,
        className, subject, teacherName, dayOfWeek, startTime, endTime,
      };
      updatedSchedules = [...scheduleItems, newItem];
      toast({ title: "Schedule Added", description: `New schedule for ${className} on ${dayOfWeek} added.` });
    }
    
    setScheduleItems(updatedSchedules);
    updateLocalStorage(updatedSchedules);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteItem = (itemId: string) => {
    if (confirm("Are you sure you want to delete this schedule item?")) {
      const updatedSchedules = scheduleItems.filter(item => item.id !== itemId);
      setScheduleItems(updatedSchedules);
      updateLocalStorage(updatedSchedules);
      toast({ title: "Schedule Item Deleted", variant: "destructive" });
    }
  };

  const daysOfWeek: ClassScheduleItem['dayOfWeek'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class Schedule Management" 
        description="Define and manage class schedules for the school."
        actions={
          <Button onClick={() => handleOpenDialog()}>
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
          {scheduleItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No class schedules defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Name</TableHead>
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
                    <TableCell className="font-medium">{item.className}</TableCell>
                    <TableCell>{item.subject}</TableCell>
                    <TableCell>{item.teacherName}</TableCell>
                    <TableCell>{item.dayOfWeek}</TableCell>
                    <TableCell>{item.startTime} - {item.endTime}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(item)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteItem(item.id)}>
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
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Clock className="mr-2 h-5 w-5" /> {editingItem ? 'Edit' : 'Add New'} Class Schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="className" className="text-right">Class Name</Label>
                <Input id="className" value={className} onChange={(e) => setClassName(e.target.value)} className="col-span-3" placeholder="e.g., Grade 10A" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subject" className="text-right">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="col-span-3" placeholder="e.g., Mathematics" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="teacherName" className="text-right">Teacher</Label>
                <Input id="teacherName" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="col-span-3" placeholder="e.g., Mr. Smith" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dayOfWeek" className="text-right">Day</Label>
                <Select value={dayOfWeek} onValueChange={(val) => setDayOfWeek(val as ClassScheduleItem['dayOfWeek'])}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map(day => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startTime" className="text-right">Start Time</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endTime" className="text-right">End Time</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" required />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingItem ? 'Save Changes' : 'Add Schedule'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
