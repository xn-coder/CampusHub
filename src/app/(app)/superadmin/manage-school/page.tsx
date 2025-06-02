
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

const MOCK_SCHOOLS_DB_KEY = 'mockSchoolsDatabase';

interface SchoolEntry {
  id: string;
  name: string;
  address: string; // Added address for completeness
  adminEmail: string;
  adminName: string;
  status: 'Active' | 'Inactive'; // Status can be managed if needed
}

export default function ManageSchoolPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [schools, setSchools] = useState<SchoolEntry[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSchools = localStorage.getItem(MOCK_SCHOOLS_DB_KEY);
      if (storedSchools) {
        setSchools(JSON.parse(storedSchools));
      } else {
        // Initialize with an empty array if no schools are stored yet
        localStorage.setItem(MOCK_SCHOOLS_DB_KEY, JSON.stringify([]));
        setSchools([]);
      }
    }
  }, []);

  const updateLocalStorage = (data: SchoolEntry[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_SCHOOLS_DB_KEY, JSON.stringify(data));
    }
  };

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.adminName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditSchool = (schoolId: string) => {
    // Placeholder for edit functionality
    toast({ title: "Edit School", description: `Editing school ${schoolId}. Functionality to be implemented.` });
  };

  const handleDeleteSchool = (schoolId: string) => {
    if (confirm('Are you sure you want to delete this school record? This action cannot be undone from the UI.')) {
      const schoolToDelete = schools.find(s => s.id === schoolId);
      if (!schoolToDelete) return;

      const updatedSchools = schools.filter(s => s.id !== schoolId);
      setSchools(updatedSchools);
      updateLocalStorage(updatedSchools);
      toast({
        title: "School Record Deleted",
        description: `${schoolToDelete.name} has been removed.`,
        variant: "destructive",
      });
    }
  };


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
              placeholder="Search schools by name, admin name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
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
              {filteredSchools.map((school) => (
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
                    <Button variant="outline" size="icon" onClick={() => handleEditSchool(school.id)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteSchool(school.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredSchools.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {searchTerm ? "No schools match your search." : "No schools registered yet. Create one via 'Create School' page."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
