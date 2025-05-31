
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CreateSchoolPage() {
  // In a real app, you would handle form state and submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Mock submission
    alert('New school creation submitted (mock).');
    // Add logic to save school details and admin credentials
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Create New School" 
        description="Fill in the details to register a new school in the system." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>New School Registration</CardTitle>
          <CardDescription>Provide the necessary information for the new school and its administrator.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="schoolName">School Name</Label>
              <Input id="schoolName" name="schoolName" placeholder="e.g., Springfield Elementary" required />
            </div>
            <div>
              <Label htmlFor="schoolAddress">School Address</Label>
              <Input id="schoolAddress" name="schoolAddress" placeholder="123 Main Street, Anytown, USA" required />
            </div>
            <hr className="my-4"/>
            <h3 className="text-lg font-medium text-foreground">Administrator Credentials</h3>
            <div>
              <Label htmlFor="adminName">Administrator Name</Label>
              <Input id="adminName" name="adminName" placeholder="e.g., Seymour Skinner" required />
            </div>
            <div>
              <Label htmlFor="adminEmail">Administrator Email (Login ID)</Label>
              <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@springfieldelementary.edu" required />
            </div>
            <div>
              <Label htmlFor="adminPassword">Administrator Password</Label>
              <Input id="adminPassword" name="adminPassword" type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full">Create School & Admin Account</Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
