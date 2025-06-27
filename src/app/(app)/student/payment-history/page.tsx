
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StudentFeePayment, FeeCategory, ClassData } from '@/types';
import { DollarSign, CalendarDays, FileText, Loader2, CreditCard, Download, School } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabaseClient';
import { getStudentPaymentHistoryAction, studentPayAllFeesAction } from '@/app/(app)/admin/student-fees/actions';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export default function StudentPaymentHistoryPage() {
    const { toast } = useToast();
    const [payments, setPayments] = useState<StudentFeePayment[]>([]);
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
    const [allClasses, setAllClasses] = useState<ClassData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBulkPaying, setIsBulkPaying] = useState(false);
    const [currentStudentProfileId, setCurrentStudentProfileId] = useState<string | null>(null);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [currentStudentName, setCurrentStudentName] = useState<string | null>(null);

    async function loadPaymentData() {
        if (currentStudentProfileId && currentSchoolId) {
            const result = await getStudentPaymentHistoryAction(currentStudentProfileId, currentSchoolId);
            if (result.ok) {
                setPayments(result.payments || []);
                setFeeCategories(result.feeCategories || []);
            } else {
                toast({ title: "Error fetching payment history", description: result.message, variant: "destructive"});
            }
        }
    }
    
    useEffect(() => {
        async function fetchInitialData() {
            setIsLoading(true);
            const studentUserId = localStorage.getItem('currentUserId');
            if (!studentUserId) {
                toast({ title: "Error", description: "Student not identified.", variant: "destructive" });
                setIsLoading(false);
                return;
            }

            const { data: studentProfile, error: profileError } = await supabase
                .from('students')
                .select('id, school_id, name')
                .eq('user_id', studentUserId)
                .single();
            
            if (profileError || !studentProfile || !studentProfile.id || !studentProfile.school_id) {
                toast({ title: "Error", description: "Could not fetch student profile or school information.", variant: "destructive"});
                setIsLoading(false);
                return;
            }
            setCurrentStudentProfileId(studentProfile.id);
            setCurrentSchoolId(studentProfile.school_id);
            setCurrentStudentName(studentProfile.name);
            
            const [paymentResult, classesResult] = await Promise.all([
                getStudentPaymentHistoryAction(studentProfile.id, studentProfile.school_id),
                supabase.from('classes').select('*').eq('school_id', studentProfile.school_id)
            ]);

            if (paymentResult.ok) {
                setPayments(paymentResult.payments || []);
                setFeeCategories(paymentResult.feeCategories || []);
            } else {
                toast({ title: "Error fetching payment history", description: paymentResult.message, variant: "destructive"});
            }

            if (classesResult.error) {
                toast({ title: "Error fetching class data", description: classesResult.error.message, variant: "destructive" });
            } else {
                setAllClasses(classesResult.data || []);
            }

            setIsLoading(false);
        }
        fetchInitialData();
    }, [toast]);
    
    const totalDue = useMemo(() => {
      return payments
          .filter(p => p.status !== 'Paid')
          .reduce((acc, p) => acc + (p.assigned_amount - p.paid_amount), 0);
    }, [payments]);

    const groupedPayments = useMemo(() => {
        const groups: Record<string, { name: string, payments: StudentFeePayment[] }> = {};
        
        payments.forEach(payment => {
            const classId = payment.class_id || 'general';
            if (!groups[classId]) {
                const className = classId === 'general' 
                    ? 'General Fees' 
                    : allClasses.find(c => c.id === classId)?.name || 'Unknown Class';
                const division = classId === 'general' ? '' : allClasses.find(c => c.id === classId)?.division;
                groups[classId] = { 
                    name: division ? `${className} - ${division}` : className,
                    payments: []
                };
            }
            groups[classId].payments.push(payment);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [payments, allClasses]);

    const handlePayTotal = async () => {
        if (!currentStudentProfileId || !currentSchoolId) {
            toast({ title: "Error", description: "User context is missing.", variant: "destructive" });
            return;
        }
        setIsBulkPaying(true);
        const result = await studentPayAllFeesAction(currentStudentProfileId, currentSchoolId);
        if (result.ok) {
            toast({ title: "Payment Successful", description: result.message });
            await loadPaymentData(); // Reload data to show updated status
        } else {
            toast({ title: "Payment Failed", description: result.message, variant: "destructive" });
        }
        setIsBulkPaying(false);
    };

    const getFeeCategoryName = (categoryId: string) => {
        return feeCategories.find(fc => fc.id === categoryId)?.name || 'N/A';
    };
    
    const formatDateSafe = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        const dateObj = parseISO(dateString);
        return isValid(dateObj) ? format(dateObj, 'PP') : 'Invalid Date';
    };

    const handleDownloadHistory = () => {
        if (payments.length === 0) {
            toast({ title: "No Data", description: "There is no payment history to download.", variant: "destructive" });
            return;
        }

        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Fee Payment History Statement", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Student: ${currentStudentName || 'N/A'}`, 14, 29);
        doc.text(`Date Generated: ${format(new Date(), 'PP')}`, 14, 34);

        let startY = 40;

        groupedPayments.forEach(group => {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Fees for: ${group.name}`, 14, startY);
            startY += 7;

            const tableColumn = ["Fee Category", "Due Date", "Assigned ($)", "Paid ($)", "Payment Date", "Status"];
            const tableRows: (string | number)[][] = [];

            group.payments.forEach(payment => {
                const paymentData = [
                    getFeeCategoryName(payment.fee_category_id),
                    formatDateSafe(payment.due_date),
                    payment.assigned_amount.toFixed(2),
                    payment.paid_amount.toFixed(2),
                    formatDateSafe(payment.payment_date),
                    payment.status
                ];
                tableRows.push(paymentData);
            });
            
            autoTable(doc, {
                startY: startY,
                head: [tableColumn],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [34, 197, 94] },
                didDrawPage: (data) => {
                    startY = data.cursor?.y ?? startY;
                }
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        });


        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(12);
        doc.text("Summary:", 14, finalY + 15);
        doc.setFontSize(10);
        const totalAssigned = payments.reduce((acc, p) => acc + p.assigned_amount, 0);
        const totalPaid = payments.reduce((acc, p) => acc + p.paid_amount, 0);
        doc.text(`Total Assigned: $${totalAssigned.toFixed(2)}`, 14, finalY + 22);
        doc.text(`Total Paid: $${totalPaid.toFixed(2)}`, 14, finalY + 28);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Due: $${totalDue.toFixed(2)}`, 14, finalY + 34);
        doc.setFont('helvetica', 'normal');

        doc.save(`payment_history_${(currentStudentName || 'student').replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

        toast({
            title: "Download Started",
            description: "Your payment history PDF is being downloaded."
        });
    };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Payment History" 
        description="View your fee payments, transaction details, and payment statuses." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />My Fee Payment Records</CardTitle>
          <CardDescription>A history of all your financial transactions with the school.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading payment history...</div>
          ) : !currentStudentProfileId ? (
             <p className="text-destructive text-center py-4">Could not load student profile. Payment history unavailable.</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payment records found for you.</p>
          ) : (
            <div className="space-y-6">
              {groupedPayments.map((group, index) => (
                <div key={index}>
                    <h3 className="text-lg font-semibold flex items-center mb-2"><School className="mr-2 h-5 w-5 text-primary"/>{group.name}</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead><FileText className="inline-block mr-1 h-4 w-4" />Fee Category</TableHead>
                            <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Due Date</TableHead>
                            <TableHead className="text-right">Assigned ($)</TableHead>
                            <TableHead className="text-right">Paid ($)</TableHead>
                            <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Payment Date</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-medium">{getFeeCategoryName(payment.fee_category_id)}</TableCell>
                                <TableCell>{formatDateSafe(payment.due_date)}</TableCell>
                                <TableCell className="text-right">${payment.assigned_amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${payment.paid_amount.toFixed(2)}</TableCell>
                                <TableCell>{formatDateSafe(payment.payment_date)}</TableCell>
                                <TableCell className="text-center">
                                <Badge variant={
                                    payment.status === 'Paid' ? 'default' :
                                    payment.status === 'Partially Paid' ? 'secondary' :
                                    payment.status === 'Overdue' ? 'destructive' : 
                                    'outline'
                                }>
                                    {payment.status}
                                </Badge>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
         {payments.length > 0 && (
            <CardFooter>
                <div className="flex flex-col sm:flex-row justify-end items-center w-full gap-4 pt-4 border-t">
                    <Button variant="outline" onClick={handleDownloadHistory} disabled={isLoading}>
                        <Download className="mr-2 h-4 w-4" />
                        Download History
                    </Button>
                    <div className="text-right">
                        <p className="text-muted-foreground">Total Amount Due</p>
                        <p className="text-2xl font-bold">${totalDue.toFixed(2)}</p>
                    </div>
                    <Button onClick={handlePayTotal} disabled={isBulkPaying || totalDue <= 0 || isLoading}>
                        {isBulkPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                        Pay Total Due
                    </Button>
                </div>
            </CardFooter>
         )}
      </Card>
    </div>
  );
}
    
