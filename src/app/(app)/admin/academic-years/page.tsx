
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarRange } from 'lucide-react';
import prisma from '@/lib/prisma';
import { format, parseISO, isValid } from 'date-fns';
import AcademicYearActions from './academic-year-actions'; // Client component for dialogs and buttons
import type { AcademicYear } from '@prisma/client';

// Revalidate data on this page every 60 seconds, or on demand
export const revalidate = 60; 

async function getAcademicYears(adminSchoolId: string | null) {
  if (!adminSchoolId) return []; // Or handle error appropriately
  try {
    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId: adminSchoolId },
      orderBy: {
        startDate: 'desc', // Newest start date first
      },
    });
    return academicYears;
  } catch (error) {
    console.error("Failed to fetch academic years:", error);
    return [];
  }
}

// Helper function to get current admin's school ID (replace with actual logic)
async function getCurrentAdminSchoolId(): Promise<string | null> {
  // This is a placeholder. In a real app, you'd get this from the user's session or context.
  // For now, let's assume the first school found for any admin user, or a hardcoded one for testing.
  // This needs to be robustly implemented based on your auth system.
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' }});
  if (adminUser) {
    const school = await prisma.school.findFirst({ where: { adminUserId: adminUser.id }});
    return school?.id || null;
  }
  return null; 
}


export default async function AcademicYearsPage() {
  // In a real app, you'd get the current admin's school ID from their session.
  // For this example, we'll simulate it. This part MUST be robustly implemented.
  const schoolId = await getCurrentAdminSchoolId(); 
  // If schoolId is null, it means either no admin, or admin not linked to a school properly.
  // Handle this case (e.g., show an error message, or redirect).
  // For now, getAcademicYears will return [] if schoolId is null.

  const academicYears = await getAcademicYears(schoolId);

  const formatDateString = (dateString: Date | string) => {
    if (!dateString) return 'N/A';
    // Prisma returns Date objects, but if it were a string:
    const dateObj = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : 'Invalid Date';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Academic Year Management" 
        description="Define and manage academic years for the school."
        actions={<AcademicYearActions schoolId={schoolId} />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CalendarRange className="mr-2 h-5 w-5" />Academic Years</CardTitle>
          <CardDescription>List of all defined academic years, newest start date first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!schoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot manage academic years.</p>
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
                    <TableCell>{formatDateString(year.startDate)}</TableCell>
                    <TableCell>{formatDateString(year.endDate)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <AcademicYearActions schoolId={schoolId} existingYear={year} />
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
