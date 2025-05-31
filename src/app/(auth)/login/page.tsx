
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole, User } from '@/types';
import { LogIn } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const MOCK_USER_DB_KEY = 'mockUserDatabase';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student'); // Default role for dropdown

  // Initialize mockUserDatabase in localStorage if it doesn't exist
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem(MOCK_USER_DB_KEY)) {
        // You could pre-populate with default admin/superadmin here if desired
        // For now, it starts empty, users are added via admin panels
        localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify([]));
      }
      // Pre-populate with a superadmin for easier initial testing
      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      let users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      if (!users.some(u => u.email === 'super@example.com')) {
        users.push({ id: 'superadmin01', email: 'super@example.com', name: 'Super Admin', role: 'superadmin', password: 'password' });
        localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify(users));
      }
      if (!users.some(u => u.email === 'admin@example.com')) {
        users.push({ id: 'admin01', email: 'admin@example.com', name: 'Admin User', role: 'admin', password: 'password' });
        localStorage.setItem(MOCK_USER_DB_KEY, JSON.stringify(users));
      }
    }
  }, []);


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (typeof window !== 'undefined') {
      const storedUsers = localStorage.getItem(MOCK_USER_DB_KEY);
      const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      
      const foundUser = users.find(user => user.email === email);

      if (foundUser && foundUser.role === role) {
        // In a real app, you'd also check password here: foundUser.password === password
        localStorage.setItem('currentUserRole', role);
        toast({
          title: "Login Successful!",
          description: `Welcome, ${foundUser.name}! You are logged in as ${role}.`,
        });
        router.push('/dashboard');
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid email, password, or role. Please check your credentials.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="App Logo" width={185} height={50} priority />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
        <CardDescription>Sign in to access your account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Login as</Label>
            <Select onValueChange={(value) => setRole(value as UserRole)} defaultValue={role}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin (College Owner)</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            <LogIn className="mr-2 h-5 w-5" /> Login
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
