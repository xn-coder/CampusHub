
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentScoresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Scores Management" 
        description="Manage and track student scores and grades." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Student Performance</CardTitle>
          <CardDescription>View and manage student academic scores.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin Student Scores page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
