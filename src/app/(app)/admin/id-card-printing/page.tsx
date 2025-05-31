
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function IdCardPrintingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="ID Card Printing" 
        description="Generate and print student and staff ID cards." 
      />
      <Card>
        <CardHeader>
          <CardTitle>ID Card Generation</CardTitle>
          <CardDescription>Select users and templates to print ID cards.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin ID Card Printing page - Content to be implemented.</p>
          <p className="mt-2 text-sm text-muted-foreground">This section will allow selection of students/staff, choice of ID card templates, and batch printing options.</p>
        </CardContent>
      </Card>
    </div>
  );
}
