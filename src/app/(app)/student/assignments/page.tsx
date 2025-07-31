
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Assignment, AssignmentSubmission } from '@/types';
import { useState, useEffect, type FormEvent, useMemo } from 'react';
import { ClipboardList, CalendarClock, Upload, Loader2, CheckCircle, Paperclip, ExternalLink, Award, MessageSquare, ArrowDownUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isPast, differenceInDays, isToday } from 'date-fns';
import { getStudentAssignmentsAction, submitAssignmentFileAction } from './actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EnrichedAssignmentClient extends Assignment {
  teacherName?: string;
  subjectName?: string;
  submission?: AssignmentSubmission | null;
}

type SortKey = 'due_date' | 'status' | 'title';

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const [myAssignments, setMyAssignments] = useState<EnrichedAssignmentClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [currentStudentProfileId, setCurrentStudentProfileId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [selectedAssignmentForSubmission, setSelectedAssignmentForSubmission] = useState<EnrichedAssignmentClient | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<SortKey>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  async function fetchAssignmentsData() {
    setIsLoading(true);
    setPageMessage(null);
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
      toast({ title: "Error", description: "User not identified. Cannot load assignments.", variant: "destructive" });
      setIsLoading(false);
      setPageMessage("User not identified. Please log in again.");
      return;
    }

    const result = await getStudentAssignmentsAction(currentUserId);

    if (result.ok) {
      setMyAssignments(result.assignments || []);
      setCurrentStudentProfileId(result.studentProfileId || null);
      setCurrentSchoolId(result.studentSchoolId || null);

      if (!result.studentClassId && result.studentProfileId) {
        setPageMessage("Your student profile is missing class information. Assignments cannot be displayed. Please contact administration.");
      } else if (result.assignments && result.assignments.length === 0 && result.studentClassId) {
        setPageMessage("No assignments posted for your class yet.");
      }
    } else {
      toast({ title: "Error Loading Assignments", description: result.message, variant: "destructive" });
      setMyAssignments([]);
      setPageMessage(result.message || "Failed to load assignments.");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchAssignmentsData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenSubmitDialog = (assignment: EnrichedAssignmentClient) => {
    setSelectedAssignmentForSubmission(assignment);
    setSubmissionFile(null);
    setSubmissionNotes('');
    setIsSubmitDialogOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Please select a file smaller than 5MB.", variant: "destructive" });
        setSubmissionFile(null);
        event.target.value = ''; // Clear the input
        return;
      }
      setSubmissionFile(file);
    } else {
      setSubmissionFile(null);
    }
  };

  const handleSubmitFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!submissionFile || !selectedAssignmentForSubmission || !currentStudentProfileId || !currentSchoolId) {
      toast({ title: "Error", description: "File, assignment, or user context is missing.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('submissionFile', submissionFile);
    formData.append('assignmentId', selectedAssignmentForSubmission.id);
    formData.append('studentId', currentStudentProfileId);
    formData.append('schoolId', currentSchoolId);
    formData.append('notes', submissionNotes);

    const result = await submitAssignmentFileAction(formData);
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Submission Successful", description: result.message });
      setIsSubmitDialogOpen(false);
      fetchAssignmentsData(); 
    } else {
      toast({ title: "Submission Failed", description: result.message, variant: "destructive" });
    }
  };
  
  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('campushub').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getStatusBadge = (assignment: EnrichedAssignmentClient) => {
    const dueDate = parseISO(assignment.due_date);
    if (assignment.submission) {
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Submitted</Badge>;
    }
    if (isPast(dueDate) && !isToday(dueDate)) {
      return <Badge variant="destructive">Past Due</Badge>;
    }
    if (isToday(dueDate)) {
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Due Today</Badge>;
    }
    const daysLeft = differenceInDays(dueDate, new Date());
    if (daysLeft >= 0) {
      return <Badge variant="secondary">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</Badge>;
    }
    return <Badge variant="outline">Upcoming</Badge>; // Fallback, though should be covered
  };
  
  const getStatusValue = (assignment: EnrichedAssignmentClient) => {
    const dueDate = parseISO(assignment.due_date);
    if (assignment.submission) return 4; // Submitted
    if (isPast(dueDate) && !isToday(dueDate)) return 0; // Past Due
    if (isToday(dueDate)) return 1; // Due Today
    return 2; // Upcoming
  }

  const sortedAssignments = useMemo(() => {
    const sorted = [...myAssignments];
    sorted.sort((a, b) => {
      if (sortBy === 'due_date') {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortBy === 'status') {
        const statusA = getStatusValue(a);
        const statusB = getStatusValue(b);
        return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
      }
      if (sortBy === 'title') {
        return sortOrder === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      }
      return 0;
    });
    return sorted;
  }, [myAssignments, sortBy, sortOrder]);


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Assignments"
        description="View upcoming and past assignments for your classes."
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your assignments...</CardContent></Card>
      ) : pageMessage ? (
         <Card><CardContent className="pt-6 text-center text-muted-foreground">{pageMessage}</CardContent></Card>
      ) : (
        <>
          <div className="flex justify-end items-center gap-2">
            <Label htmlFor="sort-by">Sort By:</Label>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortKey)}>
              <SelectTrigger id="sort-by" className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Due Date</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="title">Title</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {sortedAssignments.map((assignment) => (
              <Card key={assignment.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{assignment.title}</CardTitle>
                    {getStatusBadge(assignment)}
                  </div>
                  <CardDescription>
                    Posted by: {assignment.teacherName}
                    {assignment.subjectName && <span className="block text-xs">Subject: {assignment.subjectName}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
                   {assignment.attachment_url && (
                      <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center">
                          <Paperclip className="mr-2 h-4 w-4"/> View Attachment ({assignment.attachment_name || 'Link'})
                      </a>
                   )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Due: {format(parseISO(assignment.due_date), 'PPpp')}
                  </div>
                  
                  {assignment.submission && assignment.submission.grade && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md border border-dashed">
                      <h4 className="text-sm font-semibold flex items-center"><Award className="mr-2 h-4 w-4 text-primary"/>Grade:</h4>
                      <p className="text-lg font-bold text-primary ml-1">{assignment.submission.grade}</p>
                    </div>
                  )}
                   {assignment.submission && assignment.submission.feedback && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-md border border-dashed">
                      <h4 className="text-sm font-semibold flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-secondary-foreground"/>Teacher Feedback:</h4>
                      <p className="text-sm text-secondary-foreground whitespace-pre-wrap ml-1">{assignment.submission.feedback}</p>
                    </div>
                  )}

                  {assignment.submission && (
                    <div className="text-sm text-green-600 dark:text-green-400 pt-2">
                      <p className="font-semibold flex items-center">
                          <CheckCircle className="mr-2 h-4 w-4"/> Submitted: {assignment.submission.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">On: {format(parseISO(assignment.submission.submission_date), 'PPpp')}</p>
                      {assignment.submission.notes && <p className="text-xs text-muted-foreground mt-1">Your Notes: {assignment.submission.notes}</p>}
                       <a 
                          href={getPublicUrl(assignment.submission.file_path)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-primary hover:underline flex items-center mt-1"
                       >
                         View Submitted File <ExternalLink className="ml-1 h-3 w-3"/>
                      </a>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {!assignment.submission ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenSubmitDialog(assignment)}
                      disabled={isPast(parseISO(assignment.due_date)) && !isToday(parseISO(assignment.due_date))}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Submit Assignment
                    </Button>
                  ) : (
                     <Button variant="secondary" size="sm" disabled>
                       <CheckCircle className="mr-2 h-4 w-4" /> Already Submitted
                     </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Assignment: {selectedAssignmentForSubmission?.title}</DialogTitle>
            <CardDescription>Upload your file and add any notes for your teacher.</CardDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitFile}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="submissionFile">Upload File (Max 5MB)</Label>
                <Input
                  id="submissionFile"
                  type="file"
                  onChange={handleFileChange}
                  required
                  disabled={isSubmitting}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip" 
                />
                {submissionFile && <p className="text-xs text-muted-foreground mt-1">{submissionFile.name} ({(submissionFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
              </div>
              <div>
                <Label htmlFor="submissionNotes">Notes (Optional)</Label>
                <Textarea
                  id="submissionNotes"
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Any notes for your teacher..."
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || !submissionFile}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
