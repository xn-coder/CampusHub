
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Assignment, ClassData, Subject, UserRole } from '@/types';
import { useState, useEffect, type FormEvent, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ScrollText, CalendarDays, ClipboardList, Info, Edit2, Save, Trash2, Loader2, MoreHorizontal } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { getTeacherAssignmentsAction, updateAssignmentAction, deleteAssignmentAction } from '../post-assignments/actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabaseClient';

const NO_SUBJECT_VALUE = "__NO_SUBJECT__";

export default function TeacherAssignmentHistoryPage() {
  const { toast } = useToast();
  const [postedAssignments, setPostedAssignments] = useState<Assignment[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editSubjectId, setEditSubjectId] = useState<string>(NO_SUBJECT_VALUE);

  const fetchAssignmentData = useCallback(async () => {
    setIsLoading(true);
    const teacherUserId = localStorage.getItem('currentUserId');
    if (!teacherUserId) {
      toast({ title: "Error", description: "Teacher not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
  
    const result = await getTeacherAssignmentsAction(teacherUserId);
  
    if (result.ok) {
      setCurrentTeacherId(result.teacherProfileId || null);
      setCurrentSchoolId(result.schoolId || null);
      setPostedAssignments(result.assignments?.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()) || []);
      
      if(result.schoolId) {
        // We can now fetch classes and subjects as we have the school context
        const { data: classesData, error: classesError } = await supabase.from('classes').select('*').eq('school_id', result.schoolId);
        if (classesError) toast({ title: "Error", description: "Failed to load class data.", variant: "destructive" });
        else setAllClasses(classesData || []);

        const { data: subjectsData, error: subjectsError } = await supabase.from('subjects').select('*').eq('school_id', result.schoolId);
        if (subjectsError) toast({ title: "Error", description: "Failed to load subject data.", variant: "destructive" });
        else setAllSubjects(subjectsData || []);
      }

    } else {
      toast({ title: "Error", description: result.message || "Failed to load assignments.", variant: "destructive" });
    }
  
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAssignmentData();
  }, [fetchAssignmentData]);

  const getClassSectionName = (classId: string): string => {
    const cls = allClasses.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };
  
  const getSubjectName = (subjectId?: string | null): string => {
    if (!subjectId || subjectId === NO_SUBJECT_VALUE) return 'N/A';
    return allSubjects.find(s => s.id === subjectId)?.name || 'N/A';
  };

  const handleOpenEditDialog = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description || '');
    setEditDueDate(assignment.due_date ? format(parseISO(assignment.due_date), 'yyyy-MM-dd') : '');
    setEditSubjectId(assignment.subject_id || NO_SUBJECT_VALUE);
    setIsEditDialogOpen(true);
  };

  const handleUpdateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !editTitle.trim() || !editDescription.trim() || !editDueDate || !currentTeacherId || !currentSchoolId) {
      toast({ title: "Error", description: "Title, Description, Due Date and context are required.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    const result = await updateAssignmentAction({
      id: editingAssignment.id,
      title: editTitle.trim(),
      description: editDescription.trim(),
      due_date: editDueDate,
      subject_id: editSubjectId === NO_SUBJECT_VALUE ? null : editSubjectId,
      teacher_id: currentTeacherId, 
      school_id: currentSchoolId,   
      class_id: editingAssignment.class_id,
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast({ title: "Assignment Updated", description: `"${result.assignment?.title}" has been updated.`});
      setPostedAssignments(prev => prev.map(asm => asm.id === editingAssignment.id ? result.assignment! : asm).sort((a, b) => parseISO(b.due_date).getTime() - parseISO(a.due_date).getTime()));
      setIsEditDialogOpen(false);
      setEditingAssignment(null);
    } else {
      toast({ title: "Error Updating Assignment", description: result.message, variant: "destructive"});
    }
  };
  
  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!currentTeacherId || !currentSchoolId) return;
    if (confirm("Are you sure you want to delete this assignment? This action cannot be undone.")) {
        setIsSubmitting(true);
        const result = await deleteAssignmentAction(assignmentId, currentTeacherId, currentSchoolId);
        setIsSubmitting(false);
        if (result.ok) {
            toast({title: "Assignment Deleted", description: result.message, variant: "destructive"});
            setPostedAssignments(prev => prev.filter(asm => asm.id !== assignmentId));
        } else {
            toast({title: "Error Deleting Assignment", description: result.message, variant: "destructive"});
        }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading data...</span></div>;
  }
   if (!currentTeacherId || !currentSchoolId) {
       return (
        <div className="flex flex-col gap-6">
        <PageHeader title="My Posted Assignment History" />
        <Card><CardContent className="pt-6 text-center text-destructive">
            Could not load teacher profile or school association.
        </CardContent></Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Posted Assignment History" 
        description="View and manage assignments you have posted." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ScrollText className="mr-2 h-5 w-5" /> Assignment Log</CardTitle>
          <CardDescription>Assignments you've created, sorted by newest due date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading assignment history...</div>
          ) : !currentTeacherId ? (
             <p className="text-destructive text-center py-4">Could not identify teacher. Please log in again.</p>
          ) : postedAssignments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">You have not posted any assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><ClipboardList className="inline-block mr-1 h-4 w-4"/>Title</TableHead>
                  <TableHead>Target Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4"/>Due Date</TableHead>
                  <TableHead><Info className="inline-block mr-1 h-4 w-4"/>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postedAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.title}</TableCell>
                    <TableCell>{getClassSectionName(assignment.class_id)}</TableCell>
                    <TableCell>{getSubjectName(assignment.subject_id)}</TableCell>
                    <TableCell>{format(parseISO(assignment.due_date), 'PP')}</TableCell>
                    <TableCell className="max-w-xs truncate">{assignment.description}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSubmitting || isLoading}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => handleOpenEditDialog(assignment)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDeleteAssignment(assignment.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {postedAssignments.length > 0 && (
            <CardFooter>
                <p className="text-xs text-muted-foreground">This log helps you keep track of all assignments created. Use the actions menu to manage them.</p>
            </CardFooter>
        )}
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Assignment: {editingAssignment?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateAssignment}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editTitle">Title</Label>
                <Input id="editTitle" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required disabled={isSubmitting}/>
              </div>
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Textarea id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5} required disabled={isSubmitting}/>
              </div>
              <div>
                <Label htmlFor="editDueDate">Due Date</Label>
                <Input id="editDueDate" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} required disabled={isSubmitting}/>
              </div>
              <div>
                 <Label htmlFor="editSubjectId">Subject (Optional)</Label>
                 <Select value={editSubjectId} onValueChange={setEditSubjectId} disabled={isSubmitting}>
                    <SelectTrigger id="editSubjectId"><SelectValue placeholder="Select subject (optional)"/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NO_SUBJECT_VALUE}>None</SelectItem>
                        {allSubjects.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>))}
                    </SelectContent>
                 </Select>
              </div>
              <div>
                 <Label>Target Class (Read-only)</Label>
                 <Input value={editingAssignment ? getClassSectionName(editingAssignment.class_id) : ''} readOnly disabled />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    