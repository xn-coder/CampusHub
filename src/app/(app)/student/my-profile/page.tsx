
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and update your personal information." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>Your personal details and academic record.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Student My Profile page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
