
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Editor from '@/components/shared/ck-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Assignment, ClassData, Subject, UserRole } from '@/types'; // Added Subject
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ClipboardPlus, Send, Loader2, Paperclip } from 'lucide-react';
import { postAssignmentAction, getTeacherPostAssignmentDataAction } from './actions';

const NO_SUBJECT_VALUE = "__NO_SUBJECT__";

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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(NO_SUBJECT_VALUE);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
        setIsFetchingInitial(true);
        const teacherUserId = localStorage.getItem('currentUserId');
        if (!teacherUserId) {
            toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
            setIsFetchingInitial(false);
            return;
        }

        const result = await getTeacherPostAssignmentDataAction(teacherUserId);

        if (result.ok) {
            setCurrentTeacherId(result.teacherProfileId || null);
            setCurrentSchoolId(result.schoolId || null);
            setAssignedClasses(result.assignedClasses || []);
            setAllSubjects(result.allSubjects || []);
        } else {
            toast({ title: "Error", description: result.message || "Could not load teacher profile or school association. Ensure your account is set up.", variant: "destructive" });
        }
        setIsFetchingInitial(false);
    }
    fetchInitialData();
  }, [toast]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setSelectedClassId('');
    setSelectedSubjectId(NO_SUBJECT_VALUE);
    setAttachmentFile(null);
    const fileInput = document.getElementById('attachmentFile') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ title: "File too large", description: "Attachment must be smaller than 10MB.", variant: "destructive" });
      setAttachmentFile(null);
      event.target.value = '';
      return;
    }
    setAttachmentFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || !dueDate || !selectedClassId || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Title, Description, Due Date, Class selection, and teacher context are required.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('due_date', dueDate);
    formData.append('class_id', selectedClassId);
    formData.append('teacher_id', currentTeacherId);
    formData.append('subject_id', selectedSubjectId);
    formData.append('school_id', currentSchoolId);
    if (attachmentFile) {
        formData.append('attachment', attachmentFile);
    }
    
    const result = await postAssignmentAction(formData);
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
              <div className="mt-1 prose prose-sm max-w-none dark:prose-invert [&_.ck-editor__main>.ck-editor__editable]:min-h-40 [&_.ck-editor__main>.ck-editor__editable]:bg-background [&_.ck-toolbar]:bg-muted [&_.ck-toolbar]:border-border [&_.ck-editor__main]:border-border [&_.ck-content]:text-foreground">
                <Editor 
                  value={description}
                  onChange={(data) => setDescription(data)}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required disabled={isLoading}/>
            </div>
             <div>
                <Label htmlFor="attachmentFile">Attach File (Optional, max 10MB)</Label>
                <Input id="attachmentFile" type="file" onChange={handleFileChange} disabled={isLoading}/>
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
                  <SelectItem value={NO_SUBJECT_VALUE}>None</SelectItem>
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
