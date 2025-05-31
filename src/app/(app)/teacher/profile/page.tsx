
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TeacherProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Profile" 
        description="View and manage your personal and professional information." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Teacher Profile</CardTitle>
          <CardDescription>Your personal details and settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Teacher Profile page - Content to be implemented.</p>
        </CardContent>
      </Card>
    </div>
  );
}
