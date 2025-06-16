"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Assignment, ClassData, Subject, UserRole } from '@/types'; // Added Subject
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ClipboardPlus, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { postAssignmentAction } from './actions';

export default function PostAssignmentsPage() {
  const { toast } = useToast();
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]); // For subject dropdown
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null); // Teacher Profile ID
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(''); // Optional subject

  useEffect(() => {
    const teacherUserId = localStorage.getItem('currentUserId');
    if (teacherUserId) {
        supabase.from('teachers').select('id, school_id').eq('user_id', teacherUserId).single()
        .then(({data: teacherProfile, error: profileError}) => {
            if(profileError || !teacherProfile) {
                toast({title: "Error", description: "Could not load teacher profile.", variant: "destructive"});
                setIsFetchingInitial(false); return;
            }
            setCurrentTeacherId(teacherProfile.id);
            setCurrentSchoolId(teacherProfile.school_id);

            if (teacherProfile.id && teacherProfile.school_id) {
                Promise.all([
                    supabase.from('classes').select('*').eq('teacher_id', teacherProfile.id).eq('school_id', teacherProfile.school_id),
                    supabase.from('subjects').select('*').eq('school_id', teacherProfile.school_id) // Fetch subjects for the school
                ]).then(([classesRes, subjectsRes]) => {
                    if(classesRes.error) toast({title: "Error fetching classes", variant: "destructive"});
                    else setAssignedClasses(classesRes.data || []);

                    if(subjectsRes.error) toast({title: "Error fetching subjects", variant: "destructive"});
                    else setAllSubjects(subjectsRes.data || []);
                    
                    setIsFetchingInitial(false);
                }).catch(err => {
                    toast({ title: "Error fetching initial data", variant: "destructive"});
                    setIsFetchingInitial(false);
                });
            } else {
                 setIsFetchingInitial(false);
            }
        });
    } else {
        toast({title: "Error", description: "Teacher not identified.", variant: "destructive"});
        setIsFetchingInitial(false);
    }
  }, [toast]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setSelectedClassId('');
    setSelectedSubjectId('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || !dueDate || !selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Title, Description, Due Date, Class selection, and teacher context are required.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const result = await postAssignmentAction({
      title,
      description,
      due_date: dueDate,
      class_id: selectedClassId,
      teacher_id: currentTeacherId,
      subject_id: selectedSubjectId || undefined, // Pass undefined if not selected
      school_id: currentSchoolId,
    });
    setIsLoading(false);

    if (result.ok) {
      toast({ title: "Assignment Posted", description: `Assignment "${title}" has been posted.` });
      resetForm();
    } else {
      toast({ title: "Error Posting Assignment", description: result.message, variant: "destructive" });
    }
  };

  if (isFetchingInitial) {
      return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading data...</span></div>;
  }
  if (!currentTeacherId || !currentSchoolId) {
       return (
        <div className="flex flex-col gap-6">
        <PageHeader title="Post New Assignment" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association. Ensure your account is set up.
        </CardContent></Card>
        </div>
    );
  }


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
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Chapter 5 Reading Quiz" required disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="description">Description / Instructions</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details about the assignment..." rows={5} required disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required disabled={isLoading}/>
            </div>
            <div>
              <Label htmlFor="classSelect">Target Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} required disabled={isLoading}>
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
            <div>
              <Label htmlFor="subjectSelect">Subject (Optional)</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={isLoading}>
                <SelectTrigger id="subjectSelect">
                  <SelectValue placeholder="Select subject (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {allSubjects.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name} ({subject.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || !currentTeacherId || assignedClasses.length === 0 || !selectedClassId}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> :<Send className="mr-2 h-4 w-4" /> }
              Post Assignment
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
