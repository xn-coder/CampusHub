
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Search as SearchIcon } from 'lucide-react'; // Renamed Search to SearchIcon
import { supabase } from '@/lib/supabaseClient';
import type { SchoolEntry as School } from '@/types'; 
import EditSchoolDialog from './edit-school-dialog'; 
import DeleteSchoolButton from './delete-school-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const revalidate = 0; 

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
    `); 

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,admin_email.ilike.%${searchTerm}%,admin_name.ilike.%${searchTerm}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch schools from Supabase:", error);
      return [];
    }
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      address: item.address,
      adminEmail: item.admin_email,
      adminName: item.admin_name,
      status: item.status as 'Active' | 'Inactive',
      adminUserId: item.admin_user_id,
      createdAt: item.created_at, 
    }));
  } catch (error) {
    console.error("Unexpected error fetching schools:", error);
    return [];
  }
}

// SearchForm Client Component
function SearchForm({ initialSearchTerm }: { initialSearchTerm: string }) {
  return (
    <form action="/superadmin/manage-school" method="GET" className="mb-4 flex items-center gap-2 max-w-lg">
      <Input
        placeholder="Search by school name, admin name, or admin email..."
        name="search"
        defaultValue={initialSearchTerm}
        className="flex-grow"
      />
      <Button type="submit"><SearchIcon className="h-4 w-4 mr-2" />Search</Button>
    </form>
  );
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
          <SearchForm initialSearchTerm={searchTerm} />
          {schools.length === 0 && !searchTerm && (
            <p className="text-center text-muted-foreground py-4">No schools registered yet. Create one via 'Create School' page.</p>
          )}
          {schools.length === 0 && searchTerm && (
             <p className="text-center text-muted-foreground py-4">No schools match your search criteria "{searchTerm}".</p>
          )}
          {schools.length > 0 && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

