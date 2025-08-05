

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AdmissionRecord, ClassData, StudentFeePayment, FeeCategory, AdmissionStatus, AcademicYear, UserRole } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { ListChecks, CheckSquare, Loader2, UserPlus, FileDown, Search, Receipt, ChevronLeft, ChevronRight, Edit2, MoreHorizontal } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchAdminSchoolIdForAdmissions, fetchAdmissionPageDataAction } from './actions';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ITEMS_PER_PAGE = 10;

export default function AdmissionsPage() {
  const { toast } = useToast();
  const [admissionRecords, setAdmissionRecords] = useState<AdmissionRecord[]>([]);
  const [activeClasses, setActiveClasses] = useState<ClassData[]>([]);
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    const userId = localStorage.getItem('currentUserId');
    const role = localStorage.getItem('currentUserRole') as UserRole | null;
    setCurrentUserRole(role);

    if (!userId) {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    async function loadInitialData() {
      setIsLoading(true);
      const schoolId = await fetchAdminSchoolIdForAdmissions(userId);
      setCurrentSchoolId(schoolId);

      if (schoolId) {
        const pageDataResult = await fetchAdmissionPageDataAction(schoolId);
        if (pageDataResult.ok) {
          setAdmissionRecords(pageDataResult.admissions || []);
          setActiveClasses(pageDataResult.classes || []);
          setFeePayments(pageDataResult.feePayments || []);
          setFeeCategories(pageDataResult.feeCategories || []);
          setAcademicYears(pageDataResult.academicYears || []);
        } else {
          toast({ title: "Error loading data", description: pageDataResult.message, variant: "destructive" });
          setAdmissionRecords([]);
          setActiveClasses([]);
          setFeePayments([]);
          setFeeCategories([]);
          setAcademicYears([]);
        }
      } else {
        toast({ title: "Error", description: "Admin/Accountant not linked to a school.", variant: "destructive" });
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, [toast]);
  
  const filteredAdmissionRecords = useMemo(() => {
    return admissionRecords.filter(record => {
        const matchesSearch = searchTerm === '' || record.name.toLowerCase().includes(searchTerm.toLowerCase()) || record.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = classFilter === 'all' || record.class_id === classFilter;
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
    });
  }, [admissionRecords, searchTerm, classFilter, statusFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAdmissionRecords.slice(startIndex, endIndex);
  }, [filteredAdmissionRecords, currentPage]);
  const totalPages = Math.ceil(filteredAdmissionRecords.length / ITEMS_PER_PAGE);


  const handleDownloadCsv = () => {
    if (filteredAdmissionRecords.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive" });
        return;
    }
    const headers = ["Name", "Email", "Class Assigned", "Academic Year", "Status", "Admission Date"];
    const csvRows = [
        headers.join(','),
        ...filteredAdmissionRecords.map(record => {
            const assignedClassDetails = activeClasses.find(c => c.id === record.class_id);
            const academicYear = academicYears.find(ay => ay.id === assignedClassDetails?.academic_year_id);
            const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
            const yearText = academicYear ? academicYear.name : 'N/A';
            const admissionDate = record.admission_date ? format(parseISO(record.admission_date), 'yyyy-MM-dd') : 'N/A';
            
            const row = [
                `"${record.name.replace(/"/g, '""')}"`,
                `"${record.email.replace(/"/g, '""')}"`,
                `"${classText.replace(/"/g, '""')}"`,
                `"${yearText.replace(/"/g, '""')}"`,
                `"${record.status}"`,
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

  const getFeeCategoryName = (categoryId: string) => feeCategories.find(fc => fc.id === categoryId)?.name || 'N/A';


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="View Admission Records"
        description="Review and manage student admission records."
        actions={
          currentUserRole !== 'accountant' ? (
            <Button asChild>
              <Link href="/admin/admissions/new">
                <UserPlus className="mr-2 h-4 w-4" /> New Admission
              </Link>
            </Button>
          ) : null
        }
      />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5" />Admission Records</CardTitle>
            <CardDescription>List of all student admissions.</CardDescription>
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
                <p className="text-destructive text-center py-4">Admin/Accountant not associated with a school. Cannot view admissions.</p>
            ) : filteredAdmissionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No admission records found for the current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Class Assigned</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fees Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map(record => {
                    const assignedClassDetails = activeClasses.find(c => c.id === record.class_id);
                    const classText = assignedClassDetails ? `${assignedClassDetails.name} - ${assignedClassDetails.division}` : 'N/A';
                    
                    // Corrected logic: Use `record.class.academic_year_id` from the joined data if available
                    const academicYearId = (record.class as any)?.academic_year_id || assignedClassDetails?.academic_year_id;
                    const academicYear = academicYears.find(ay => ay.id === academicYearId);
                    const yearText = academicYear ? academicYear.name : 'N/A';

                    const studentFees = record.student_profile_id ? feePayments.filter(p => p.student_id === record.student_profile_id) : [];
                    const pendingFeeCount = studentFees.filter(p => p.status !== 'Paid').length;

                    return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.email}</TableCell>
                      <TableCell>{classText}</TableCell>
                      <TableCell>{yearText}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'Admitted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          record.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={studentFees.length === 0}>
                              <Receipt className="mr-1 h-3 w-3" /> 
                              {pendingFeeCount > 0 ? `${pendingFeeCount} Pending` : studentFees.length > 0 ? 'All Paid' : 'N/A'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <h4 className="font-medium leading-none">Assigned Fees</h4>
                                <p className="text-sm text-muted-foreground">Status of fees for {record.name}.</p>
                              </div>
                              <ul className="space-y-1 text-sm">
                                {studentFees.map(fee => (
                                  <li key={fee.id} className="flex justify-between">
                                    <span>{getFeeCategoryName(fee.fee_category_id)}</span>
                                    <Badge variant={fee.status === 'Paid' ? 'default' : fee.status === 'Partially Paid' ? 'secondary' : 'destructive'}>
                                      {fee.status}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSubmitting}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild disabled={true}>
                                <Link href={`/admin/manage-students/${record.student_profile_id}/edit`}>
                                    <Edit2 className="mr-2 h-4 w-4"/> Edit Details
                                </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
          )}
        </Card>
    </div>
  );
}
