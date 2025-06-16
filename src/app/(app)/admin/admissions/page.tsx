
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdmissionRecord, ClassData } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ListChecks, CheckSquare, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabaseClient';
import { updateAdmissionStatusAction } from './actions';

async function fetchAdminSchoolId(adminUserId: string): Promise<string | null> {
  const { data: school, error } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUserId)
    .single();
  if (error || !school) {
    console.error("Error fetching admin's school:", error?.message);
    return null;
  }
  return school.id;
}

export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  useEffect(() => {
    const adminId = localStorage.getItem('currentUserId');
    setCurrentAdminUserId(adminId);
    if (adminId) {
      fetchAdminSchoolId(adminId).then(schoolId => {
        setCurrentSchoolId(schoolId);
        if (schoolId) {
          fetchAdmissionData(schoolId);
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

  async function fetchAdmissionData(schoolId: string) {
    setIsLoading(true);
    const { data: admissionsData, error: admissionsError } = await supabase
      .from('admission_records')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (admissionsError) {
      toast({ title: "Error fetching admissions", description: admissionsError.message, variant: "destructive" });
    } else {
      setAdmissionRecords(admissionsData || []);
    }

    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name, division')
      .eq('school_id', schoolId);
    
    if (classesError) {
      toast({ title: "Error fetching classes", description: classesError.message, variant: "destructive" });
    } else {
      setActiveClasses(classesData || []);
    }
    setIsLoading(false);
  }
  
  const handleEnrollStudent = async (admissionId: string) => {
    if (!currentSchoolId) {
        toast({title: "Error", description: "School context missing.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const admission = admissionRecords.find(ar => ar.id === admissionId);
    if (admission) {
        const result = await updateAdmissionStatusAction(admissionId, 'Enrolled', currentSchoolId);
        if (result.ok) {
            toast({ title: "Student Enrolled", description: `${admission.name} is now marked as enrolled.` });
            fetchAdmissionData(currentSchoolId); // Re-fetch to update UI
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    }
    setIsSubmitting(false);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="View Admission Records"
        description="Review submitted student admission applications and their enrollment status."
      />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Admission Records</CardTitle>
            <CardDescription>List of submitted student admission applications. New students are registered by teachers.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[calc(theme(space.96)_*_2.5)] overflow-y-auto">
            {isLoading ? (
                <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !currentSchoolId ? (
                <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view admissions.</p>
            ) : admissionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No admission records found for this school.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Class Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admissionRecords.map(record => {
                    const assignedClassDetails = activeClasses.find(c => c.id === record.class_id);
                    const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
                    return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.email}</TableCell>
                      <TableCell>{classText}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'Enrolled' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          record.status === 'Admitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          record.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.status === 'Admitted' && (
                           <Button variant="outline" size="sm" onClick={() => handleEnrollStudent(record.id)} disabled={isSubmitting}>
                             {isSubmitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <CheckSquare className="mr-1 h-3 w-3" />} Enroll
                           </Button>
                        )}
                         {record.status === 'Enrolled' && (
                           <span className="text-sm text-green-600 dark:text-green-400">Enrolled</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

    