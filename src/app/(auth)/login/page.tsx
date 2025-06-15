
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole } from '@/types';
import { LogIn, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ensureSuperAdminExists, attemptLogin } from './actions';

const SUPERADMIN_SETUP_FLAG = 'SUPERADMIN_DB_SETUP_COMPLETE_FLAG_V5_PRISMA_BCRYPT';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSuperAdminSetupDone, setIsSuperAdminSetupDone] = useState(false);

  useEffect(() => {
    const setupSuperAdmin = async () => {
      if (typeof window !== 'undefined' && !localStorage.getItem(SUPERADMIN_SETUP_FLAG)) {
        console.log("Attempting to ensure Superadmin exists...");
        const result = await ensureSuperAdminExists();
        if (result.ok) {
          localStorage.setItem(SUPERADMIN_SETUP_FLAG, 'true');
          console.log(result.message);
        } else {
          console.error("Superadmin setup failed:", result.message);
          // Optionally, inform the user if critical, though this is a background task.
        }
      }
      setIsSuperAdminSetupDone(true); // Mark setup attempt as done
    };
    setupSuperAdmin();
  }, []);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    const result = await attemptLogin(email, password, role);

    if (result.ok && result.user) {
      localStorage.setItem('currentUserRole', result.user.role);
      localStorage.setItem('currentUserId', result.user.id);
      localStorage.setItem('currentUserName', result.user.name); // Store name for convenience
      
      toast({
        title: "Login Successful!",
        description: `Welcome, ${result.user.name}! You are logged in as ${role}.`,
      });
      router.push('/dashboard');
    } else {
      toast({
        title: "Login Failed",
        description: result.message || "Invalid credentials or role.",
        variant: "destructive",
      });
    }
    setIsLoggingIn(false);
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
      {!isSuperAdminSetupDone ? (
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Initializing...</p>
        </CardContent>
      ) : (
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
                disabled={isLoggingIn}
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
                disabled={isLoggingIn}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Login as</Label>
              <Select onValueChange={(value) => setRole(value as UserRole)} defaultValue={role} disabled={isLoggingIn}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin (College Owner)</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              {isLoggingIn ? 'Logging in...' : 'Login'}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
