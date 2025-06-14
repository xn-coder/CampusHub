
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CalendarDays, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';

// Mock payment data structure
interface MockPayment {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Failed';
  invoiceId: string;
}

const mockPayments: MockPayment[] = [
  { id: '1', date: '2024-03-15', description: 'Tuition Fee - Term 1', amount: 1200, status: 'Paid', invoiceId: 'INV-2024-001' },
  { id: '2', date: '2024-03-20', description: 'Lab Fee - Chemistry', amount: 50, status: 'Paid', invoiceId: 'INV-2024-002' },
  { id: '3', date: '2024-04-10', description: 'Sports Fee - Annual', amount: 75, status: 'Pending', invoiceId: 'INV-2024-003' },
];


export default function StudentPaymentHistoryPage() {
    const [payments, setPayments] = useState<MockPayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // In a real app, fetch payment history for the logged-in student
        // For now, just use mock data after a delay
        setTimeout(() => {
            setPayments(mockPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setIsLoading(false);
        }, 500);
    }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Payment History" 
        description="View your fee payments, transaction details, and payment statuses." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5" />Fee Payment Records</CardTitle>
          <CardDescription>A history of all your financial transactions with the school.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading payment history...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No payment records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><CalendarDays className="inline-block mr-1 h-4 w-4" />Date</TableHead>
                  <TableHead><FileText className="inline-block mr-1 h-4 w-4" />Description</TableHead>
                  <TableHead className="text-right"><DollarSign className="inline-block mr-1 h-4 w-4" />Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Invoice ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{payment.description}</TableCell>
                    <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={
                        payment.status === 'Paid' ? 'default' :
                        payment.status === 'Pending' ? 'secondary' :
                        'destructive'
                      }>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{payment.invoiceId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

