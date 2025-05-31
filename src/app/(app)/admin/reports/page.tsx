
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Reports Generation" 
        description="Generate and view various school reports." 
      />
      <Card>
        <CardHeader>
          <CardTitle>School Reports</CardTitle>
          <CardDescription>Access and generate administrative and academic reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin Reports page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
