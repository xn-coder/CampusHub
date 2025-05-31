
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentStudyMaterialPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Study Material" 
        description="Access study resources and materials for your subjects." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Learning Resources</CardTitle>
          <CardDescription>Notes, presentations, and other study aids.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Student Study Material page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
