
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { FeeTypeGroup, FeeType, Student, StudentFeePayment, ClassData } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, useMemo } from 'react';
import { PlusCircle, Edit2, Trash2, Save, Group, Loader2, MoreHorizontal, ArrowLeft, Filter, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { createFeeTypeGroupAction, updateFeeTypeGroupAction, deleteFeeTypeGroupAction, getFeeTypeGroupsAction, getAssignedFeeGroupsAction, assignFeeGroupToStudentsAction } from './actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, isValid } from 'date-fns';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getStudentsForSchoolAction } from '../manage-students/actions';
import { getFeeTypesAction } from '../manage-fee-types/actions';

async function fetchUserSchoolId(userId: string): Promise<string | null> {
  const { data: user, error } = await supabase.from('users').select('school_id').eq('id', userId).single();
  if (error || !user?.school_id) {
    console.error("Error fetching user's school:", error?.message);
    return null;
  }
  return user.school_id;
}

export default function ManageFeeGroupsPage() {
  const { toast } = useToast();
  const [feeGroups, setFeeGroups] = useState<FeeTypeGroup[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<(StudentFeePayment & { student: {name: string, email: string}, fee_type_group: {name: string}})[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allFeeTypes, setAllFeeTypes] = useState<FeeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  // Form states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingFeeGroup, setEditingFeeGroup] = useState<FeeTypeGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedFeeTypeIdsForGroup, setSelectedFeeTypeIdsForGroup] = useState<string[]>([]);
  
  // States for Assign Group tab
  const [assignTargetType, setAssignTargetType] = useState<'class' | 'individual'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignGroupId, setAssignGroupId] = useState<string>('');
  const [assignAmounts, setAssignAmounts] = useState<Record<string, number | ''>>({});
  
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter(s => s.class_id === selectedClassId);
  }, [selectedClassId, allStudents]);

  const fetchPageData = useCallback(async (schoolId: string) => {
    setIsLoading(true);
    const [groupsResult, assignedGroupsResult, studentsResult, feeTypesResult, classesResult] = await Promise.all([
      getFeeTypeGroupsAction(schoolId),
      getAssignedFeeGroupsAction(schoolId),
      getStudentsForSchoolAction(schoolId),
      getFeeTypesAction(schoolId),
      supabase.from('classes').select('id, name, division').eq('school_id', schoolId)
    ]);
      
    if (groupsResult.ok) setFeeGroups(groupsResult.groups || []);
    else toast({ title: "Error fetching fee groups", variant: "destructive" });

    if (assignedGroupsResult.ok) setAssignedGroups(assignedGroupsResult.assignedGroups || []);
    else toast({ title: "Error fetching assigned groups", variant: "destructive" });

    if (studentsResult.ok) setAllStudents(studentsResult.students || []);
    else toast({ title: "Error fetching students", variant: "destructive" });
    
    if (feeTypesResult.ok) setAllFeeTypes(feeTypesResult.feeTypes || []);
    else toast({ title: "Error fetching fee types", variant: "destructive" });

    if (!classesResult.error) setAllClasses(classesResult.data || []);
    else toast({ title: "Error fetching classes", variant: "destructive" });

    setIsLoading(false);
  }, [toast]);
  
  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    if (userId) {
      fetchUserSchoolId(userId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchPageData(schoolId);
        } else {
          toast({ title: "Error", description: "Your account is not linked to a school.", variant: "destructive" });
          setIsLoading(false);
        }
      });
    } else {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast, fetchPageData]);

  const resetForm = () => {
    setGroupName('');
    setSelectedFeeTypeIdsForGroup([]);
    setEditingFeeGroup(null);
  };
  
  const resetAssignmentForm = () => {
    setAssignTargetType('class');
    setSelectedClassId('');
    setSelectedStudentIds([]);
    setAssignGroupId('');
    setAssignAmounts({});
  };

  const handleOpenDialog = (group?: FeeTypeGroup) => {
    if (group) {
      setEditingFeeGroup(group);
      setGroupName(group.name);
      setSelectedFeeTypeIdsForGroup(group.fee_type_ids);
    } else {
      resetForm();
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedFeeTypeIdsForGroup.length === 0 || !currentSchoolId) {
      toast({ title: "Error", description: "Group Name and at least one Fee Type are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const groupData = { 
      name: groupName.trim(),
      fee_type_ids: selectedFeeTypeIdsForGroup,
      school_id: currentSchoolId 
    };

    let result = editingFeeGroup ? await updateFeeTypeGroupAction(editingFeeGroup.id, groupData) : await createFeeTypeGroupAction(groupData);
    if (result.ok) {
      toast({ title: editingFeeGroup ? "Group Updated" : "Group Created", description: result.message });
      resetForm();
      setIsFormDialogOpen(false);
      if (currentSchoolId) fetchPageData(currentSchoolId);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteGroup = async (groupId: string) => {
    if (!currentSchoolId) return;
    setIsSubmitting(true);
    const result = await deleteFeeTypeGroupAction(groupId, currentSchoolId);
    toast({ title: result.ok ? "Group Deleted" : "Error", description: result.message, variant: result.ok ? "destructive" : "destructive" });
    if (result.ok && currentSchoolId) fetchPageData(currentSchoolId);
    setIsSubmitting(false);
  };
  
  const handleAssignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const studentIdsToAssign = assignTargetType === 'class' ? allStudents.filter(s => s.class_id === selectedClassId).map(s => s.id) : selectedStudentIds;
    const finalAmounts = Object.fromEntries(
        Object.entries(assignAmounts).map(([key, value]) => [key, Number(value) || 0])
    );
    if (studentIdsToAssign.length === 0 || !assignGroupId || !currentSchoolId) {
        toast({ title: "Error", description: "Please select students and a fee group.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const result = await assignFeeGroupToStudentsAction({
        student_ids: studentIdsToAssign,
        fee_group_id: assignGroupId,
        school_id: currentSchoolId,
        amounts: finalAmounts
    });
    if (result.ok) {
        toast({ title: "Group Assigned", description: result.message });
        if(currentSchoolId) fetchPageData(currentSchoolId);
        resetAssignmentForm();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Type Groups"
        description="Bundle multiple fee types into groups for easier assignment."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/fees-management"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees</Link>
            </Button>
            <Button onClick={() => handleOpenDialog()} disabled={!currentSchoolId || isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Fee Group
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="groups">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="groups">Fee Groups</TabsTrigger>
            <TabsTrigger value="assign">Assign Group</TabsTrigger>
            <TabsTrigger value="assigned-log">Assignment Log ({assignedGroups.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="groups">
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Group className="mr-2 h-5 w-5" />Created Fee Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  : feeGroups.length === 0 ? <p className="text-muted-foreground text-center py-4">No fee groups have been created yet.</p>
                  : <Table><TableHeader><TableRow><TableHead>Group Name</TableHead><TableHead>Fee Types Included</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{feeGroups.map((group) => (<TableRow key={group.id}><TableCell className="font-medium">{group.name}</TableCell><TableCell className="text-xs text-muted-foreground">{group.fee_type_ids.map(id => allFeeTypes.find(ft => ft.id === id)?.name || 'Unknown').join(', ')}</TableCell><TableCell className="text-right"><AlertDialog><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(group)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger></DropdownMenuContent></DropdownMenu><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will permanently delete the fee group "{group.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGroup(group.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table>
                  }
                </CardContent>
              </Card>
        </TabsContent>

        <TabsContent value="assign">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Receipt className="mr-2 h-5 w-5"/>Assign Fee Group</CardTitle>
                    <CardDescription>Assign a fee group to a whole class or individual students.</CardDescription>
                </CardHeader>
                 <form onSubmit={handleAssignSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Assign To</Label>
                                <Select value={assignTargetType} onValueChange={(val) => { setAssignTargetType(val as any); setSelectedClassId(''); setSelectedStudentIds([]); }}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="class">Entire Class</SelectItem><SelectItem value="individual">Individual Students</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Select Class</Label>
                                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                    <SelectTrigger><SelectValue placeholder="Choose a class"/></SelectTrigger>
                                    <SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                         {assignTargetType === 'individual' && (
                            <div>
                                <Label>Select Student(s)</Label>
                                <div className="max-h-60 overflow-y-auto space-y-2 border p-2 rounded-md">
                                    {studentsInSelectedClass.length > 0 ? studentsInSelectedClass.map(student => (
                                        <div key={student.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-muted/50">
                                            <Checkbox
                                                id={`assign-student-${student.id}`}
                                                checked={selectedStudentIds.includes(student.id)}
                                                onCheckedChange={(checked) => setSelectedStudentIds(prev => checked ? [...prev, student.id] : prev.filter(id => id !== student.id))}
                                            />
                                            <Label htmlFor={`assign-student-${student.id}`} className="font-normal w-full cursor-pointer">{student.name}</Label>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">No students in this class or no class selected.</p>}
                                </div>
                            </div>
                        )}
                        <div><Label>Fee Group to Assign</Label><Select value={assignGroupId} onValueChange={setAssignGroupId}><SelectTrigger><SelectValue placeholder="Select a fee group"/></SelectTrigger><SelectContent>{feeGroups.map(fg => <SelectItem key={fg.id} value={fg.id}>{fg.name}</SelectItem>)}</SelectContent></Select></div>
                        
                        {assignGroupId && (
                            <div className="space-y-3 pt-2 border-t">
                                <h4 className="font-medium text-sm">Enter Amounts for Fee Types</h4>
                                {allFeeTypes
                                    .filter(ft => feeGroups.find(fg => fg.id === assignGroupId)?.fee_type_ids.includes(ft.id))
                                    .map(ft => (
                                    <div key={ft.id} className="grid grid-cols-3 items-center gap-2">
                                        <Label htmlFor={`amount-${ft.id}`} className="col-span-2">{ft.display_name}</Label>
                                        <Input
                                            id={`amount-${ft.id}`}
                                            type="number"
                                            placeholder={`Default: ${ft.amount || 0}`}
                                            value={assignAmounts[ft.id] || ''}
                                            onChange={e => setAssignAmounts(prev => ({...prev, [ft.id]: e.target.value === '' ? '' : parseFloat(e.target.value)}))}
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Assign Group
                        </Button>
                    </CardFooter>
                 </form>
            </Card>
        </TabsContent>

        <TabsContent value="assigned-log">
            <Card>
                 <CardHeader><CardTitle className="flex items-center">Assigned Groups Log</CardTitle></CardHeader>
                <CardContent>
                     {isLoading ? (<div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>) : assignedGroups.length === 0 ? (<p className="text-muted-foreground text-center py-4">No fee groups have been assigned yet.</p>) : (
                        <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Group</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{assignedGroups.map(fee => (<TableRow key={fee.id}><TableCell className="font-medium">{fee.student.name}</TableCell><TableCell>{fee.fee_type_group?.name || 'N/A'}</TableCell><TableCell><Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{fee.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFeeGroup ? 'Edit' : 'Create New'} Fee Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-4">
              <div>
                <Label htmlFor="groupName">Group Name</Label>
                <Input id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., Annual Fees, New Admission Pack" required disabled={isSubmitting} />
              </div>
              <div>
                <Label>Select Fee Types to Include</Label>
                <Card className="max-h-60 overflow-y-auto p-2 border">
                  <div className="space-y-2">
                    {allFeeTypes.map(ft => (
                        <div key={ft.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`ft-${ft.id}`} 
                                checked={selectedFeeTypeIdsForGroup.includes(ft.id)}
                                onCheckedChange={(checked) => {
                                    setSelectedFeeTypeIdsForGroup(prev => checked ? [...prev, ft.id] : prev.filter(id => id !== ft.id))
                                }}
                            />
                            <Label htmlFor={`ft-${ft.id}`} className="font-normal">{ft.display_name}</Label>
                        </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} {editingFeeGroup ? 'Save Changes' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
