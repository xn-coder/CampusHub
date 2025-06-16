
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Assignment, AssignmentSubmission, Student } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, BookOpenCheck, Loader2, ExternalLink, Download, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient'; // For student file URL
import { 
    getTeacherAssignmentsForGradingAction, 
    getSubmissionsForAssignmentAction, 
    saveSingleGradeAndFeedbackAction 
} from './actions';

interface EnrichedSubmissionClient extends AssignmentSubmission {
  student_name: string;
  student_email: string;
}

interface GradeInputState {
  [submissionId: string]: {
    grade: string;
    feedback: string;
  };
}

export default function TeacherGradeAssignmentsPage() {
  const { toast } = useToast();
  const [teacherAssignments, setTeacherAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [submissions, setSubmissions] = useState<EnrichedSubmissionClient[]>([]);
  const [gradesAndFeedback, setGradesAndFeedback] = useState<GradeInputState>({});
  
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState<Record<string, boolean>>({}); // For individual save buttons

  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

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
      setSubmissions([]); // Clear previous submissions
      setGradesAndFeedback({}); // Clear previous grades
      getSubmissionsForAssignmentAction(selectedAssignmentId, currentSchoolId)
        .then(result => {
          if (result.ok && result.submissions) {
            setSubmissions(result.submissions);
            // Initialize gradesAndFeedback state from fetched submissions
            const initialGrades: GradeInputState = {};
            result.submissions.forEach(sub => {
              initialGrades[sub.id] = {
                grade: sub.grade || '',
                feedback: sub.feedback || '',
              };
            });
            setGradesAndFeedback(initialGrades);
          } else {
            toast({ title: "Error fetching submissions", description: result.message, variant: "destructive" });
          }
        })
        .finally(() => setIsLoadingSubmissions(false));
    } else {
      setSubmissions([]);
      setGradesAndFeedback({});
    }
  }, [selectedAssignmentId, currentSchoolId, toast]);
  
  const handleGradeChange = (submissionId: string, value: string) => {
    setGradesAndFeedback(prev => ({
      ...prev,
      [submissionId]: { ...prev[submissionId], grade: value },
    }));
  };

  const handleFeedbackChange = (submissionId: string, value: string) => {
     setGradesAndFeedback(prev => ({
      ...prev,
      [submissionId]: { ...prev[submissionId], feedback: value },
    }));
  };
  
  const handleSaveSingleGrade = async (submissionId: string) => {
    if (!currentSchoolId) {
        toast({ title: "Error", description: "School context missing.", variant: "destructive"});
        return;
    }
    const currentGradeData = gradesAndFeedback[submissionId];
    if (!currentGradeData || !currentGradeData.grade.trim()) {
        toast({ title: "Error", description: "Grade cannot be empty.", variant: "destructive"});
        return;
    }

    setIsSavingGrade(prev => ({ ...prev, [submissionId]: true }));
    const result = await saveSingleGradeAndFeedbackAction({
        submission_id: submissionId,
        grade: currentGradeData.grade,
        feedback: currentGradeData.feedback,
        school_id: currentSchoolId,
    });
    setIsSavingGrade(prev => ({ ...prev, [submissionId]: false }));

    if (result.ok && result.updatedSubmission) {
        toast({ title: "Grade Saved", description: "Grade and feedback have been saved for this submission."});
        // Update local state for the specific submission to reflect saved data
        setSubmissions(prevSubs => prevSubs.map(sub => 
            sub.id === submissionId ? { ...sub, grade: result.updatedSubmission?.grade, feedback: result.updatedSubmission?.feedback } : sub
        ));
    } else {
        toast({ title: "Error Saving Grade", description: result.message, variant: "destructive"});
    }
  };

  const getPublicFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('assignment-submissions').getPublicUrl(filePath);
    return data.publicUrl;
  };

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
                <h3 className="text-lg font-semibold">Submissions for: {selectedAssignmentDetails?.title}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Submitted File</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map(sub => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="font-medium">{sub.student_name}</div>
                          <div className="text-xs text-muted-foreground">{sub.student_email}</div>
                          <div className="text-xs text-muted-foreground">Submitted: {format(parseISO(sub.submission_date), 'PPpp')}</div>
                        </TableCell>
                        <TableCell>
                          <a href={getPublicFileUrl(sub.file_path)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm">
                            <Download className="mr-1 h-3 w-3"/>{sub.file_name}
                          </a>
                           {sub.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {sub.notes}</p>}
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <Input
                            value={gradesAndFeedback[sub.id]?.grade || ''}
                            onChange={(e) => handleGradeChange(sub.id, e.target.value)}
                            placeholder="e.g., A, 90%"
                            disabled={isSavingGrade[sub.id]}
                            className="text-sm h-9"
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Textarea
                            value={gradesAndFeedback[sub.id]?.feedback || ''}
                            onChange={(e) => handleFeedbackChange(sub.id, e.target.value)}
                            placeholder="Provide feedback..."
                            rows={2}
                            disabled={isSavingGrade[sub.id]}
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => handleSaveSingleGrade(sub.id)} 
                            disabled={isSavingGrade[sub.id] || !gradesAndFeedback[sub.id]?.grade.trim()}
                          >
                            {isSavingGrade[sub.id] ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Save className="mr-1 h-3 w-3"/>}
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
