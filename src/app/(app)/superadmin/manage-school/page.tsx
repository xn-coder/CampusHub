
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2, Search, Building, Settings } from 'lucide-react';
import { useState } from 'react';

// Mock data for demonstration
const mockSchools = [
  { id: '1', name: 'Springfield Elementary', adminEmail: 'principal@springfield.edu', status: 'Active', adminName: 'Seymour Skinner' },
  { id: '2', name: 'Shelbyville High', adminEmail: 'headmaster@shelbyvillehigh.com', status: 'Active', adminName: 'John Doe' },
  { id: '3', name: 'Ogdenville Academy', adminEmail: 'dean@ogdenville.org', status: 'Inactive', adminName: 'Jane Smith' },
];

interface SchoolEntry {
  id: string;
  name: string;
  adminEmail: string;
  status: 'Active' | 'Inactive';
  adminName: string;
}

export default function ManageSchoolPage() {
  const [searchTerm, setSearchTerm] = useState('');
  // In a real app, schools would be fetched from a data source
  const [schools, setSchools] = useState<SchoolEntry[]>(mockSchools);

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.adminName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditSchool = (schoolId: string) => {
    alert(`Edit school ${schoolId} - functionality to be implemented.`);
  };

  const handleDeleteSchool = (schoolId: string) => {
    if (confirm('Are you sure you want to deactivate/delete this school? This action cannot be undone.')) {
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      alert(`School ${schoolId} deactivated/deleted (mock).`);
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
                <TableHead>Administrator Name</TableHead>
                <TableHead>Admin Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school.adminName}</TableCell>
                  <TableCell>{school.adminEmail}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${school.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {school.status}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-2">
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
              {searchTerm ? "No schools match your search." : "No schools registered yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
