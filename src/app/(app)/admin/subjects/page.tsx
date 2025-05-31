
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SubjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Subjects Management" 
        description="Define and manage subjects offered by the school." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Subject List</CardTitle>
          <CardDescription>Manage school subjects and their details.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin Subjects page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
