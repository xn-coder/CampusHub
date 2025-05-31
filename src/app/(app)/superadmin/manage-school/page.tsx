
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2, Search } from 'lucide-react';

// Mock data for demonstration
const mockSchools = [
  { id: '1', name: 'Springfield Elementary', adminEmail: 'principal@springfield.edu', status: 'Active' },
  { id: '2', name: 'Shelbyville High', adminEmail: 'headmaster@shelbyvillehigh.com', status: 'Active' },
  { id: '3', name: 'Ogdenville Academy', adminEmail: 'dean@ogdenville.org', status: 'Inactive' },
];

export default function ManageSchoolPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Manage Schools" 
        description="View, edit, or deactivate schools in the system." 
      />
      <Card>
        <CardHeader>
          <CardTitle>Registered Schools</CardTitle>
          <CardDescription>A list of all schools currently in the CampusHub system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search schools by name or admin email..."
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSchools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school.adminEmail}</TableCell>
                  <TableCell>{school.status}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="icon" onClick={() => alert('Edit ' + school.name)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => alert('Delete ' + school.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {mockSchools.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No schools registered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
