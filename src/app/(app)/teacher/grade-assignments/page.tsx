
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Assignment, AssignmentSubmission } from '@/types';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, BookOpenCheck, Loader2, Download, FileText, User, ArrowDownUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient'; 
import { 
    getTeacherAssignmentsForGradingAction, 
    getSubmissionsForAssignmentAction, 
    saveSingleGradeAndFeedbackAction 
} from './actions';

interface EnrichedSubmissionClient extends AssignmentSubmission {
  student_name: string;
  student_email: string;
}

type SortKey = 'student_name' | 'submission_date' | 'grade';

export default function TeacherGradeAssignmentsPage() {
  const { toast } = useToast();
  const [teacherAssignments, setTeacherAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [submissions, setSubmissions] = useState<EnrichedSubmissionClient[]>([]);
  
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isGradeDialogValid, setIsGradeDialogValid] = useState(false);
  const [selectedSubmissionForGrading, setSelectedSubmissionForGrading] = useState<EnrichedSubmissionClient | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');

  // Sorting state
  const [sortBy, setSortBy] = useState<SortKey>('student_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchInitialData = useCallback(async () => {
    setIsLoadingAssignments(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
      setIsLoadingAssignments(false);
      return;
    }

    const { data: teacherProfile, error: profileError } = await supabase
      .from('teachers').select('id, school_id').eq('user_id', teacherUserId).single();
    
    if (profileError || !teacherProfile) {
      toast({ title: "Error", description: "Could not load teacher profile.", variant: "destructive" });
      setIsLoadingAssignments(false);
      return;
    }
    setCurrentTeacherId(teacherProfile.id);
    setCurrentSchoolId(teacherProfile.school_id);

    if (teacherProfile.id && teacherProfile.school_id) {
      const assignmentsResult = await getTeacherAssignmentsForGradingAction(teacherProfile.id, teacherProfile.school_id);
      if (assignmentsResult.ok && assignmentsResult.assignments) {
        setTeacherAssignments(assignmentsResult.assignments);
      } else {
        toast({ title: "Error fetching assignments", description: assignmentsResult.message, variant: "destructive" });
      }
    }
    setIsLoadingAssignments(false);
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (selectedAssignmentId && currentSchoolId) {
      setIsLoadingSubmissions(true);
      setSubmissions([]);
      getSubmissionsForAssignmentAction(selectedAssignmentId, currentSchoolId)
        .then(result => {
          if (result.ok && result.submissions) {
            setSubmissions(result.submissions);
          } else {
            toast({ title: "Error fetching submissions", description: result.message, variant: "destructive" });
          }
        })
        .finally(() => setIsLoadingSubmissions(false));
    } else {
      setSubmissions([]);
    }
  }, [selectedAssignmentId, currentSchoolId, toast]);
  
  const handleOpenGradeDialog = (submission: EnrichedSubmissionClient) => {
    setSelectedSubmissionForGrading(submission);
    setGradeInput(submission.grade || '');
    setFeedbackInput(submission.feedback || '');
    setIsGradeDialogValid(true);
  };

  const handleSaveGradeAndFeedback = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSubmissionForGrading || !currentSchoolId || !gradeInput.trim()) {
        toast({ title: "Error", description: "Submission, school context, and grade are required.", variant: "destructive"});
        return;
    }
    setIsSavingGrade(true);
    const result = await saveSingleGradeAndFeedbackAction({
        submission_id: selectedSubmissionForGrading.id,
        grade: gradeInput,
        feedback: feedbackInput,
        school_id: currentSchoolId,
    });
    setIsSavingGrade(false);

    if (result.ok && result.updatedSubmission) {
        toast({ title: "Grade Saved", description: "Grade and feedback have been saved."});
        setSubmissions(prevSubs => prevSubs.map(sub => 
            sub.id === selectedSubmissionForGrading.id ? { ...sub, grade: result.updatedSubmission?.grade, feedback: result.updatedSubmission?.feedback } : sub
        ));
        setIsGradeDialogValid(false);
        setSelectedSubmissionForGrading(null);
    } else {
        toast({ title: "Error Saving Grade", description: result.message, variant: "destructive"});
    }
  };

  const getPublicFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('assignment_submissions').getPublicUrl(filePath);
    return data.publicUrl;
  };
  
  const sortedSubmissions = useMemo(() => {
    const sorted = [...submissions];
    sorted.sort((a, b) => {
      if (sortBy === 'student_name') {
        return sortOrder === 'asc' ? a.student_name.localeCompare(b.student_name) : b.student_name.localeCompare(a.student_name);
      }
      if (sortBy === 'submission_date') {
        return sortOrder === 'asc'
          ? new Date(a.submission_date).getTime() - new Date(b.submission_date).getTime()
          : new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime();
      }
      if (sortBy === 'grade') {
        const gradeA = a.grade || '';
        const gradeB = b.grade || '';
        return sortOrder === 'asc' ? gradeA.localeCompare(gradeB) : gradeB.localeCompare(gradeA);
      }
      return 0;
    });
    return sorted;
  }, [submissions, sortBy, sortOrder]);


  const selectedAssignmentDetails = teacherAssignments.find(asm => asm.id === selectedAssignmentId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Grade Assignments" 
        description="Select an assignment to view submissions and provide grades and feedback." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BookOpenCheck className="mr-2 h-5 w-5" /> Select Assignment</CardTitle>
          <Select 
            value={selectedAssignmentId} 
            onValueChange={setSelectedAssignmentId}
            disabled={isLoadingAssignments || teacherAssignments.length === 0}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose an assignment to grade" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingAssignments ? (
                <SelectItem value="loading" disabled><Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>Loading assignments...</SelectItem>
              ) : teacherAssignments.length > 0 ? (
                teacherAssignments.map(asm => (
                  <SelectItem key={asm.id} value={asm.id}>
                    {asm.title} (Due: {format(parseISO(asm.due_date), 'PP')}) - Class: {(asm.class as any)?.name} - {(asm.class as any)?.division}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-assignments" disabled>No assignments posted by you yet.</SelectItem>
              )}
            </SelectContent>
          </Select>
        </CardHeader>

        {selectedAssignmentId && (
          <CardContent>
            {isLoadingSubmissions ? (
              <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin"/> Loading submissions...</div>
            ) : submissions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No submissions yet for "{selectedAssignmentDetails?.title}".</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Submissions for: {selectedAssignmentDetails?.title}</h3>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="sort-submissions">Sort By:</Label>
                         <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortKey)}>
                            <SelectTrigger id="sort-submissions" className="w-[180px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="student_name">Student Name</SelectItem>
                                <SelectItem value="submission_date">Submission Date</SelectItem>
                                <SelectItem value="grade">Grade</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                            <ArrowDownUp className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortedSubmissions.map(sub => (
                    <Card key={sub.id}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center"><User className="mr-2 h-4 w-4"/>{sub.student_name}</CardTitle>
                        <CardDescription>{sub.student_email}</CardDescription>
                        <CardDescription className="text-xs">Submitted: {format(parseISO(sub.submission_date), 'PPpp')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <a href={getPublicFileUrl(sub.file_path)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm">
                          <Download className="mr-1 h-3 w-3"/>{sub.file_name}
                        </a>
                        {sub.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {sub.notes}</p>}
                        
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-sm font-medium">Grade: <span className="font-normal text-primary">{sub.grade || 'Not Graded'}</span></p>
                          {sub.feedback && <p className="text-xs text-muted-foreground mt-1">Feedback: {sub.feedback}</p>}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenGradeDialog(sub)}
                        >
                          <Edit className="mr-1 h-3 w-3"/> Edit Grade
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={isGradeDialogValid} onOpenChange={setIsGradeDialogValid}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grade Submission: {selectedSubmissionForGrading?.student_name}</DialogTitle>
            <CardDescription>For assignment: {selectedAssignmentDetails?.title}</CardDescription>
          </DialogHeader>
          <form onSubmit={handleSaveGradeAndFeedback}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="gradeInput">Grade</Label>
                <Input 
                  id="gradeInput" 
                  value={gradeInput} 
                  onChange={(e) => setGradeInput(e.target.value)} 
                  placeholder="e.g., A+, 95/100, Pass" 
                  required 
                  disabled={isSavingGrade}
                />
              </div>
              <div>
                <Label htmlFor="feedbackInput">Feedback (Optional)</Label>
                <Textarea 
                  id="feedbackInput" 
                  value={feedbackInput} 
                  onChange={(e) => setFeedbackInput(e.target.value)} 
                  placeholder="Provide constructive feedback..." 
                  rows={4}
                  disabled={isSavingGrade}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSavingGrade}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSavingGrade || !gradeInput.trim()}>
                {isSavingGrade ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                {isSavingGrade ? 'Saving...' : 'Save Grade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
