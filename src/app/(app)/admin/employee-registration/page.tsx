
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import type { Employee } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { PlusCircle, Edit2, Trash2, Save, UsersRound, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MOCK_EMPLOYEES_KEY = 'mockEmployeesData';
const MOCK_USER_DB_KEY = 'mockUserDatabase'; // For creating login credentials

export default function EmployeeRegistrationPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(''); // e.g., Accountant, Librarian
  const [department, setDepartment] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmployees = localStorage.getItem(MOCK_EMPLOYEES_KEY);
      if (storedEmployees) setEmployees(JSON.parse(storedEmployees));
      else localStorage.setItem(MOCK_EMPLOYEES_KEY, JSON.stringify([]));
      
      if (!localStorage.getItem(MOCK_USER_DB_KEY)) localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify([]));
    }
  }, []);

  const updateLocalStorage = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('');
    setDepartment('');
    setJoiningDate('');
    setProfilePictureUrl('');
    setEditingEmployee(null);
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setName(employee.name);
      setEmail(employee.email);
      setRole(employee.role);
      setDepartment(employee.department);
      setJoiningDate(employee.joiningDate);
      setProfilePictureUrl(employee.profilePictureUrl || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !role.trim() || !department.trim() || !joiningDate) {
      toast({ title: "Error", description: "All fields except profile picture are required.", variant: "destructive" });
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as any[];
    
    // Check for email uniqueness if adding new or changing email
    if ((!editingEmployee || (editingEmployee && editingEmployee.email !== email.trim())) && storedUsers.some(u => u.email === email.trim())) {
        toast({ title: "Error", description: "A user (admin/teacher/student/employee) with this email already exists.", variant: "destructive" });
        return;
    }


    let updatedEmployees;
    if (editingEmployee) {
      updatedEmployees = employees.map(emp =>
        emp.id === editingEmployee.id ? { ...emp, name: name.trim(), email: email.trim(), role: role.trim(), department: department.trim(), joiningDate, profilePictureUrl: profilePictureUrl.trim() } : emp
      );
      
      // Update corresponding user in MOCK_USER_DB_KEY if email changed
      const updatedUsers = storedUsers.map(u => 
        u.id === editingEmployee.id ? {...u, name: name.trim(), email: email.trim() } : u
      );
      updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);

      toast({ title: "Employee Updated", description: `${name.trim()} has been updated.` });
    } else {
      const newEmployeeId = `emp-${Date.now()}`;
      const newEmployee: Employee = {
        id: newEmployeeId,
        name: name.trim(),
        email: email.trim(),
        role: role.trim(),
        department: department.trim(),
        joiningDate,
        profilePictureUrl: profilePictureUrl.trim() || `https://placehold.co/100x100.png?text=${name.substring(0,1)}`
      };
      updatedEmployees = [newEmployee, ...employees];
      
      // Create a mock user login for this employee (simplified role, e.g., 'staff')
      const newStaffUser = {
        id: newEmployeeId,
        name: newEmployee.name,
        email: newEmployee.email,
        role: 'staff', // Generic role for now
        password: 'password' // Default password
      };
      storedUsers.push(newStaffUser);
      updateLocalStorage(MOCK_USER_DB_KEY, storedUsers);

      toast({ title: "Employee Added", description: `${name.trim()} has been added with a default login.` });
    }
    
    setEmployees(updatedEmployees);
    updateLocalStorage(MOCK_EMPLOYEES_KEY, updatedEmployees);
    resetForm();
    setIsDialogOpen(false);
  };
  
  const handleDeleteEmployee = (employeeId: string) => {
    if (confirm("Are you sure you want to delete this employee record and their login access?")) {
      const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
      setEmployees(updatedEmployees);
      updateLocalStorage(MOCK_EMPLOYEES_KEY, updatedEmployees);

      // Remove from MOCK_USER_DB_KEY
      const storedUsers = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]') as any[];
      const updatedUsers = storedUsers.filter(u => u.id !== employeeId);
      updateLocalStorage(MOCK_USER_DB_KEY, updatedUsers);

      toast({ title: "Employee Deleted", variant: "destructive" });
    }
  };
  
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Employee Registration & Management" 
        description="Manage records for all school employees (teaching and non-teaching staff)."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><UsersRound className="mr-2 h-5 w-5" />Employee Records</CardTitle>
          <CardDescription>Oversee all staff member profiles and information. Default password for new employees is 'password'.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="mb-4">
             <Input 
                placeholder="Search employees by name, email, role, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
            />
           </div>
          {filteredEmployees.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
             {searchTerm && employees.length > 0 ? "No employees match your search." : "No employees registered yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                       <Avatar>
                          <AvatarImage src={employee.profilePictureUrl} alt={employee.name} data-ai-hint="person staff" />
                          <AvatarFallback>{employee.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.role}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{new Date(employee.joiningDate).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(employee)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteEmployee(employee.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit' : 'Add New'} Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="Full Name" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" placeholder="employee@example.com" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">Role/Position</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} className="col-span-3" placeholder="e.g., Accountant, IT Support" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="department" className="text-right">Department</Label>
                <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className="col-span-3" placeholder="e.g., Finance, Administration" required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="joiningDate" className="text-right">Joining Date</Label>
                <Input id="joiningDate" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="col-span-3" required />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="profilePictureUrl" className="text-right">Profile URL</Label>
                <Input id="profilePictureUrl" value={profilePictureUrl} onChange={(e) => setProfilePictureUrl(e.target.value)} className="col-span-3" placeholder="Optional image URL" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingEmployee ? 'Save Changes' : 'Add Employee'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
