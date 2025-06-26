
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdmissionRecord, ClassData, StudentFeePayment, FeeCategory, AdmissionStatus } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ListChecks, CheckSquare, Loader2, UserPlus, FileDown, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { updateAdmissionStatusAction, fetchAdminSchoolIdForAdmissions, fetchAdmissionPageDataAction } from './actions';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';


export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | 'all'>('all');


  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (!adminUserId) {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    async function loadInitialData() {
      setIsLoading(true);
      const schoolId = await fetchAdminSchoolIdForAdmissions(adminUserId);
      setCurrentSchoolId(schoolId);

      if (schoolId) {
        const pageDataResult = await fetchAdmissionPageDataAction(schoolId);
        if (pageDataResult.ok) {
          setAdmissionRecords(pageDataResult.admissions || []);
          setActiveClasses(pageDataResult.classes || []);
          setFeePayments(pageDataResult.feePayments || []);
          setFeeCategories(pageDataResult.feeCategories || []);
        } else {
          toast({ title: "Error loading data", description: pageDataResult.message, variant: "destructive" });
          setAdmissionRecords([]);
          setActiveClasses([]);
          setFeePayments([]);
          setFeeCategories([]);
        }
      } else {
        toast({ title: "Error", description: "Admin not linked to a school.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, [toast]);

  async function refreshAdmissionData() {
    if (!currentSchoolId) return;
    setIsLoading(true);
    const pageDataResult = await fetchAdmissionPageDataAction(currentSchoolId);
    if (pageDataResult.ok) {
        setAdmissionRecords(pageDataResult.admissions || []);
        setActiveClasses(pageDataResult.classes || []);
        setFeePayments(pageDataResult.feePayments || []);
        setFeeCategories(pageDataResult.feeCategories || []);
    } else {
        toast({ title: "Error refreshing data", description: pageDataResult.message, variant: "destructive" });
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
            refreshAdmissionData();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    }
    setIsSubmitting(false);
  };

  const admissionFeeCategory = feeCategories.find(fc => fc.name.toLowerCase() === 'admission fee');

  const getFeeStatusText = (record: AdmissionRecord) => {
    if (admissionFeeCategory && record.student_profile_id) {
        const payment = feePayments.find(p => 
            p.student_id === record.student_profile_id && 
            p.fee_category_id === admissionFeeCategory.id
        );
        if (payment) {
            return payment.status;
        } else {
            return "Not Assigned";
        }
    }
    return "N/A";
  };
  
  const filteredAdmissionRecords = useMemo(() => {
    return admissionRecords.filter(record => {
        const matchesSearch = searchTerm === '' || record.name.toLowerCase().includes(searchTerm.toLowerCase()) || record.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = classFilter === 'all' || record.class_id === classFilter;
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
    });
  }, [admissionRecords, searchTerm, classFilter, statusFilter]);

  const handleDownloadCsv = () => {
    if (filteredAdmissionRecords.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive" });
        return;
    }
    const headers = ["Name", "Email", "Class Assigned", "Status", "Admission Fee Status", "Admission Date"];
    const csvRows = [
        headers.join(','),
        ...filteredAdmissionRecords.map(record => {
            const assignedClassDetails = activeClasses.find(c => c.id === record.class_id);
            const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
            const feeStatusText = getFeeStatusText(record);
            const admissionDate = record.admission_date ? format(parseISO(record.admission_date), 'yyyy-MM-dd') : 'N/A';
            
            const row = [
                `"${record.name.replace(/"/g, '""')}"`,
                `"${record.email.replace(/"/g, '""')}"`,
                `"${classText.replace(/"/g, '""')}"`,
                `"${record.status}"`,
                `"${feeStatusText}"`,
                `"${admissionDate}"`
            ];
            return row.join(',');
        })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `admission_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="View Admission Records"
        description="Review submitted student admission applications and their enrollment status."
        actions={
          <Button asChild>
            <Link href="/admin/admissions/new">
              <UserPlus className="mr-2 h-4 w-4" /> New Admission
            </Link>
          </Button>
        }
      />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Admission Records</CardTitle>
            <CardDescription>List of submitted student admission applications. New students are registered by teachers or admins.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="mb-4 flex flex-col md:flex-row gap-4">
                <Input 
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="md:w-[200px]"><SelectValue placeholder="Filter by class"/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {activeClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.division}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as AdmissionStatus | 'all')}>
                    <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Filter by status"/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Pending Review">Pending Review</SelectItem>
                        <SelectItem value="Admitted">Admitted</SelectItem>
                        <SelectItem value="Enrolled">Enrolled</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={handleDownloadCsv} disabled={isLoading || filteredAdmissionRecords.length === 0} className="md:ml-auto">
                    <FileDown className="mr-2 h-4 w-4" /> Download Report
                </Button>
            </div>
            {isLoading ? (
                <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin" /> Loading records...</div>
            ) : !currentSchoolId ? (
                <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view admissions.</p>
            ) : filteredAdmissionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No admission records found for the current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Class Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admission Fee</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmissionRecords.map(record => {
                    const assignedClassDetails = activeClasses.find(c => c.id === record.class_id);
                    const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
                    
                    let feeStatus: React.ReactNode = <span className="text-xs text-muted-foreground">N/A</span>;
                    if (admissionFeeCategory && record.student_profile_id) {
                        const payment = feePayments.find(p => 
                            p.student_id === record.student_profile_id && 
                            p.fee_category_id === admissionFeeCategory.id
                        );

                        if (payment) {
                            feeStatus = (
                                <Badge variant={payment.status === 'Paid' ? 'default' : payment.status === 'Partially Paid' ? 'secondary' : 'destructive'}>
                                    {payment.status}
                                </Badge>
                            );
                        } else {
                            feeStatus = <span className="text-xs text-muted-foreground">Not Assigned</span>;
                        }
                    }

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
                      <TableCell>{feeStatus}</TableCell>
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
