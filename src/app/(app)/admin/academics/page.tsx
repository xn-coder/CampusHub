
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AcademicsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Academics Management" 
        description="Oversee academic programs, curriculum, and standards." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Academic Overview</CardTitle>
          <CardDescription>Manage academic settings and information.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Admin Academics page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
