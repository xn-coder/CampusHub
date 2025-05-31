
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentPaymentHistoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Payment History" 
        description="View your fee payments and transaction history." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Fee Payments</CardTitle>
          <CardDescription>Record of your past payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Student Payment History page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
