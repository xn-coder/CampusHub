
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import type { SchoolEntry as School } from '@/types'; // Using your defined type
import EditSchoolDialog from './edit-school-dialog'; 
import DeleteSchoolButton from './delete-school-button';

export const revalidate = 0; // Revalidate on every request for dynamic data

async function getSchools(searchTerm?: string): Promise<School[]> {
  try {
    let query = supabase.from('schools').select(`
      id,
      name,
      address,
      admin_email,
      admin_name,
      status,
      admin_user_id,
      created_at
    `); // Adjust column names if they differ in your Supabase table

    if (searchTerm) {
      // Supabase textSearch or multiple ilike filters might be complex here for multiple fields
      // Simplification: search by name only for this example.
      // For multi-column search, you might need a database function or multiple .or() conditions.
      query = query.ilike('name', `%${searchTerm}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch schools from Supabase:", error);
      return [];
    }
    // Map Supabase data to your School type, assuming column names match or need mapping
    // This example assumes direct mapping where snake_case from DB maps to camelCase in type
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      address: item.address,
      adminEmail: item.admin_email,
      adminName: item.admin_name,
      status: item.status as 'Active' | 'Inactive',
      adminUserId: item.admin_user_id,
      // createdAt: item.created_at, // Add if in your type and needed
    }));
  } catch (error) {
    console.error("Unexpected error fetching schools:", error);
    return [];
  }
}

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
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search form can be a client component submitting to reload the page with query params */}
          {/*
          <form action="/superadmin/manage-school" method="GET" className="mb-4 flex items-center gap-2">
            <Input
              placeholder="Search schools by name..."
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
                    {/* Pass the Supabase-compatible School object to EditSchoolDialog */}
                    <EditSchoolDialog school={{
                      id: school.id,
                      name: school.name,
                      address: school.address,
                      adminEmail: school.adminEmail, // Supabase field name assumed as admin_email
                      adminName: school.adminName,   // Supabase field name assumed as admin_name
                      status: school.status,
                      adminUserId: school.adminUserId,
                      // Map other fields if your EditSchoolDialog or actions expect them
                    }} />
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
