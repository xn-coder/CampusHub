
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CreateSchoolPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Create New School" 
        description="Fill in the details to register a new school in the system." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>New School Registration</CardTitle>
          <CardDescription>Provide the necessary information for the new school.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="schoolName">School Name</Label>
            <Input id="schoolName" name="schoolName" placeholder="e.g., Springfield Elementary" />
          </div>
          <div>
            <Label htmlFor="schoolAddress">School Address</Label>
            <Input id="schoolAddress" name="schoolAddress" placeholder="123 Main Street, Anytown, USA" />
          </div>
          <div>
            <Label htmlFor="adminEmail">Administrator Email</Label>
            <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@springfieldelementary.edu" />
          </div>
          <Button className="w-full">Create School</Button>
        </CardContent>
      </Card>
    </div>
  );
}
