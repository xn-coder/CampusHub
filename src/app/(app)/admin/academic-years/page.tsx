
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarRange } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; // Import supabase client
import { format, parseISO, isValid } from 'date-fns';
import AcademicYearActions from './academic-year-actions';
import type { User } from '@/types'; // For User type

// Define a type for academic year data fetched from Supabase
// Assuming your Supabase table has columns like id, name, start_date, end_date, school_id
interface AcademicYear {
  id: string;
  name: string;
  start_date: string; // Supabase returns date strings
  end_date: string;
  school_id: string;
}

export const revalidate = 0; // Revalidate on every request for dynamic data

async function getAcademicYears(adminSchoolId: string | null): Promise<AcademicYear[]> {
  if (!adminSchoolId) return [];
  try {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, name, start_date, end_date, school_id')
      .eq('school_id', adminSchoolId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error("Failed to fetch academic years from Supabase:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Unexpected error fetching academic years:", error);
    return [];
  }
}

async function getCurrentAdminSchoolId(): Promise<string | null> {
  // This is a placeholder. In a real app, you'd get this from the user's session or context.
  // For Supabase, you might get the logged-in user's ID from session, then query their school.
  // For now, let's simulate by finding an admin user and their associated school.
  // This logic needs to be robustly implemented based on your auth system.
  // Assuming user ID is stored in a way that can be retrieved server-side (e.g., via cookies or Supabase auth context)

  // This part would ideally use Supabase auth to get current user, then query their school
  // For now, fetching the first admin from 'users' and then their school from 'schools'
  const { data: adminUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (userError || !adminUser) {
    console.error("Error fetching admin user or no admin found:", userError);
    return null;
  }

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('id')
    .eq('admin_user_id', adminUser.id) // Assuming schools table has admin_user_id
    .limit(1)
    .single();
  
  if (schoolError || !school) {
    console.error("Error fetching school for admin or admin not linked:", schoolError);
    return null;
  }
  return school.id;
}


export default async function AcademicYearsPage() {
  const schoolId = await getCurrentAdminSchoolId(); 
  const academicYears = await getAcademicYears(schoolId);

  const formatDateString = (dateString: string | Date) => {
    if (!dateString) return 'N/A';
    const dateObj = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Academic Year Management" 
        description="Define and manage academic years for the school."
        actions={<AcademicYearActions schoolId={schoolId} />} // Pass schoolId
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarRange className="mr-2 h-5 w-5" />Academic Years</CardTitle>
          <CardDescription>List of all defined academic years, newest start date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!schoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school or school ID not found. Cannot manage academic years.</p>
          ) : academicYears.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No academic years defined yet for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.name}</TableCell>
                    <TableCell>{formatDateString(year.start_date)}</TableCell>
                    <TableCell>{formatDateString(year.end_date)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      {/* Map Supabase row to the expected PrismaAcademicYearType or adjust AcademicYearActions */}
                      <AcademicYearActions 
                        schoolId={schoolId} 
                        existingYear={{
                          id: year.id,
                          name: year.name,
                          startDate: new Date(year.start_date), // Convert string to Date
                          endDate: new Date(year.end_date),     // Convert string to Date
                          schoolId: year.school_id
                        }} 
                      />
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
