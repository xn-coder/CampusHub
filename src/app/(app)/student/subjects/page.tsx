
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentSubjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Subjects" 
        description="View the subjects you are enrolled in." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Subjects</CardTitle>
          <CardDescription>List of your current subjects and teachers.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Student My Subjects page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
