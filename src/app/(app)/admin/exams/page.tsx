
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ExamsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Exams Management" 
        description="Schedule and manage school examinations." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Examination Schedule</CardTitle>
          <CardDescription>Oversee all examination-related activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin Exams page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
