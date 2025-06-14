
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Assignment, ClassData } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ClipboardPlus, Send } from 'lucide-react';

const MOCK_ASSIGNMENTS_KEY = 'mockAssignmentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';

export default function PostAssignmentsPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const teacherId = localStorage.getItem('currentUserId');
      setCurrentTeacherId(teacherId);

      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      const allClasses: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
      const teacherClasses = teacherId ? allClasses.filter(c => c.teacherId === teacherId) : [];
      setAssignedClasses(teacherClasses);
    }
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setSelectedClassSectionId('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || !dueDate || !selectedClassSectionId || !currentTeacherId) {
      toast({ title: "Error", description: "All fields including class selection are required.", variant: "destructive" });
      return;
    }
    
    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      title,
      description,
      dueDate,
      classSectionId: selectedClassSectionId,
      teacherId: currentTeacherId,
    };

    const storedAssignments = localStorage.getItem(MOCK_ASSIGNMENTS_KEY);
    const allAssignments: Assignment[] = storedAssignments ? JSON.parse(storedAssignments) : [];
    allAssignments.push(newAssignment);
    localStorage.setItem(MOCK_ASSIGNMENTS_KEY, JSON.stringify(allAssignments));

    toast({ title: "Assignment Posted", description: `Assignment "${title}" has been posted for the selected class.` });
    resetForm();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Post New Assignment" 
        description="Create and assign homework or tasks for your classes." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><ClipboardPlus className="mr-2 h-5 w-5" /> New Assignment Details</CardTitle>
          <CardDescription>Fill in the form to post a new assignment.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Chapter 5 Reading Quiz" required />
            </div>
            <div>
              <Label htmlFor="description">Description / Instructions</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details about the assignment..." rows={5} required />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="classSelect">Target Class</Label>
              <Select value={selectedClassSectionId} onValueChange={setSelectedClassSectionId} required>
                <SelectTrigger id="classSelect">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {assignedClasses.length > 0 ? (
                    assignedClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="-" disabled>No classes assigned to you</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {assignedClasses.length === 0 && currentTeacherId && (
                 <p className="text-xs text-muted-foreground mt-1">You are not assigned to any classes. Assignments can only be posted to your classes.</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={!currentTeacherId || assignedClasses.length === 0}>
              <Send className="mr-2 h-4 w-4" /> Post Assignment
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
