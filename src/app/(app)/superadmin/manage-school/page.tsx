
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building } from 'lucide-react';
import prisma from '@/lib/prisma';
import type { School } from '@prisma/client'; // Prisma auto-generated type
import EditSchoolDialog from './edit-school-dialog'; // Client Component for dialog
import DeleteSchoolButton from './delete-school-button'; // Client Component for delete button

// Revalidate data on this page every 60 seconds, or on demand
export const revalidate = 60; 

async function getSchools(searchTerm?: string) {
  try {
    const schools = await prisma.school.findMany({
      where: searchTerm ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { adminEmail: { contains: searchTerm, mode: 'insensitive' } },
          { adminName: { contains: searchTerm, mode: 'insensitive' } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ],
      } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return schools;
  } catch (error) {
    console.error("Failed to fetch schools:", error);
    return [];
  }
}

// Search form needs to be a client component to manage state
// For simplicity, we'll pass searchTerm via query params for now if we were to implement search fully server-side
// Or, keep the whole page client-side if complex filtering/sorting is needed without full page reloads.
// For this refactor, making it a server component for initial load. Advanced search can be added later.

export default async function ManageSchoolPage({
  searchParams,
}: {
  searchParams?: {
    search?: string;
  };
}) {
  const searchTerm = searchParams?.search || '';
  const schools = await getSchools(searchTerm);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Schools"
        description="View, edit, or deactivate schools in the system."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5" /> Registered Schools</CardTitle>
          <CardDescription>A list of all schools currently in the CampusHub system.
            {/* Search input can be added here if made a client component or via form submitting to server */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 
          <form className="mb-4 flex items-center gap-2">
            <Input
              placeholder="Search schools by name, admin, or address..."
              name="search"
              defaultValue={searchTerm}
              className="max-w-md"
            />
            <Button type="submit"><Search className="h-4 w-4 mr-2" />Search</Button>
          </form> 
          */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Administrator Name</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school.address}</TableCell>
                  <TableCell>{school.adminName}</TableCell>
                  <TableCell>{school.adminEmail}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      school.status === 'Active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {school.status}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <EditSchoolDialog school={school} />
                    <DeleteSchoolButton schoolId={school.id} schoolName={school.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {schools.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {searchTerm ? "No schools match your search." : "No schools registered yet. Create one via 'Create School' page."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
