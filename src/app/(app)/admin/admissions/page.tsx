
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdmissionRecord, ClassData } from '@/types';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ListChecks, CheckSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MOCK_ADMISSIONS_KEY = 'mockAdmissionsData';
const MOCK_CLASSES_KEY = 'mockClassesData'; // For activated class-sections

export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedAdmissions = localStorage.getItem(MOCK_ADMISSIONS_KEY);
      if (storedAdmissions) setAdmissionRecords(JSON.parse(storedAdmissions));
      else localStorage.setItem(MOCK_ADMISSIONS_KEY, JSON.stringify([]));
      
      const storedActiveClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      if (storedActiveClasses) setActiveClasses(JSON.parse(storedActiveClasses));
      else localStorage.setItem(MOCK_CLASSES_KEY, JSON.stringify([]));
    }
  }, []);

  const updateLocalStorage = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };
  
  const handleEnrollStudent = (admissionId: string) => {
    const admission = admissionRecords.find(ar => ar.id === admissionId);
    if (admission) {
        const updatedRecords = admissionRecords.map(ar => 
            ar.id === admissionId ? {...ar, status: 'Enrolled'} : ar
        );
        setAdmissionRecords(updatedRecords);
        updateLocalStorage(MOCK_ADMISSIONS_KEY, updatedRecords);
        toast({ title: "Student Enrolled", description: `${admission.name} is now marked as enrolled.` });
    }
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
            {admissionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No admission records found.</p>
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
                  {admissionRecords.slice().reverse().map(record => {
                    const assignedClassDetails = activeClasses.find(c => c.id === record.classId);
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
                           <Button variant="outline" size="sm" onClick={() => handleEnrollStudent(record.id)}>
                             <CheckSquare className="mr-1 h-3 w-3" /> Enroll
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
