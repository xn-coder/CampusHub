"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Student } from '@/types';
import { useState } from 'react';
import { PlusCircle, Edit2, Trash2, Search } from 'lucide-react';

// Mock data
const initialStudents: Student[] = [
  { id: '1', name: 'Alice Wonderland', email: 'alice@example.com', classId: '10A', profilePictureUrl: 'https://placehold.co/40x40.png?text=AW' },
  { id: '2', name: 'Bob The Builder', email: 'bob@example.com', classId: '10B', profilePictureUrl: 'https://placehold.co/40x40.png?text=BB' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', classId: '11A' },
];

export default function StudentProfilePage() {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Placeholder functions for CRUD operations
  const handleAddStudent = () => { /* TODO */ alert('Add student functionality to be implemented.'); };
  const handleEditStudent = (student: Student) => { setEditingStudent(student); /* TODO: show modal/form */ alert(`Editing ${student.name}. Form to be implemented.`); };
  const handleDeleteStudent = (studentId: string) => { 
    setStudents(prev => prev.filter(s => s.id !== studentId)); 
    alert(`Student ${studentId} deleted (mock).`);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Profiles" 
        description="Manage student information and administrative tasks."
        actions={<Button onClick={handleAddStudent}><PlusCircle className="mr-2 h-4 w-4" /> Add Student</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Student List</CardTitle>
          <CardDescription>View and manage all student profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={student.profilePictureUrl} alt={student.name} data-ai-hint="person portrait" />
                      <AvatarFallback>{student.name.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.classId}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEditStudent(student)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteStudent(student.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredStudents.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No students found.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Placeholder for editing form/modal */}
      {editingStudent && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Edit Student: {editingStudent.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Editing form for {editingStudent.name} would appear here.</p>
            <Button onClick={() => setEditingStudent(null)} variant="outline" className="mt-4">Cancel</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
