
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeacherStudentScoresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Enter Student Scores" 
        description="Input and manage grades for your students." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Gradebook</CardTitle>
          <CardDescription>Manage student scores and assessments.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Teacher Enter Student Scores page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
