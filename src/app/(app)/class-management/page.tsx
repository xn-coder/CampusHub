"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ClassData, Student, Teacher } from '@/types';
import { useState } from 'react';
import { PlusCircle, Edit2, Trash2, Users, UserCog } from 'lucide-react';

// Mock data
const initialClasses: ClassData[] = [
  { id: '1', name: 'Grade 10', division: 'A', teacherId: 't1', studentIds: ['s1', 's2'] },
  { id: '2', name: 'Grade 10', division: 'B', teacherId: 't2', studentIds: ['s3', 's4'] },
  { id: '3', name: 'Grade 11', division: 'A', teacherId: 't3', studentIds: ['s5'] },
];
const mockTeachers: Teacher[] = [
    { id: 't1', name: 'Mr. Smith', email: 'smith@example.com', subject: 'Math' },
    { id: 't2', name: 'Ms. Jones', email: 'jones@example.com', subject: 'Science' },
    { id: 't3', name: 'Dr. Who', email: 'who@example.com', subject: 'History' },
];
const mockStudents: Student[] = [
    { id: 's1', name: 'Alice', email: 'a@example.com', classId: '10A' },
    { id: 's2', name: 'Bob', email: 'b@example.com', classId: '10A' },
    { id: 's3', name: 'Charlie', email: 'c@example.com', classId: '10B' },
    { id: 's4', name: 'Diana', email: 'd@example.com', classId: '10B' },
    { id: 's5', name: 'Eve', email: 'e@example.com', classId: '11A' },
];


export default function ClassManagementPage() {
  const [classes, setClasses] = useState<ClassData[]>(initialClasses);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  const getTeacherName = (teacherId?: string) => mockTeachers.find(t => t.id === teacherId)?.name || 'N/A';

  // Placeholder functions for CRUD operations
  const handleAddClass = () => { /* TODO */ alert('Add class functionality to be implemented.'); };
  const handleEditClass = (cls: ClassData) => { setEditingClass(cls); /* TODO: show modal/form */ alert(`Editing ${cls.name} - ${cls.division}. Form to be implemented.`); };
  const handleDeleteClass = (classId: string) => { 
    setClasses(prev => prev.filter(c => c.id !== classId)); 
    alert(`Class ${classId} deleted (mock).`);
  };
  const handleManageStudents = (cls: ClassData) => { /* TODO */ alert(`Manage students for ${cls.name} - ${cls.division}. To be implemented.`); };
  const handleAssignTeacher = (cls: ClassData) => { /* TODO */ alert(`Assign teacher for ${cls.name} - ${cls.division}. To be implemented.`); };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Class & Division Management" 
        description="Create and manage classes, divisions, and assign students/teachers."
        actions={<Button onClick={handleAddClass}><PlusCircle className="mr-2 h-4 w-4" /> Create New Class</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Class List</CardTitle>
          <CardDescription>Overview of all classes and divisions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>No. of Students</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.division}</TableCell>
                  <TableCell>{getTeacherName(cls.teacherId)}</TableCell>
                  <TableCell>{cls.studentIds.length}</TableCell>
                  <TableCell className="space-x-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditClass(cls)}><Edit2 className="mr-1 h-3 w-3" /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleManageStudents(cls)}><Users className="mr-1 h-3 w-3" /> Students</Button>
                    <Button variant="outline" size="sm" onClick={() => handleAssignTeacher(cls)}><UserCog className="mr-1 h-3 w-3" /> Teacher</Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteClass(cls.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {classes.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No classes created yet.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Placeholder for editing/creation form/modal */}
      {editingClass && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Edit Class: {editingClass.name} - {editingClass.division}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Editing form for {editingClass.name} - {editingClass.division} would appear here.</p>
            <Button onClick={() => setEditingClass(null)} variant="outline" className="mt-4">Cancel</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
