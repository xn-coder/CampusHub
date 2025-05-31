
"use client";

import type React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUserRole');
    }
    toast({
      title: "Logout Successful",
      description: "You have been logged out.",
    });
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar variant="sidebar" collapsible="icon" side="left">
        <SidebarHeader className="p-4 flex items-center justify-between">
          <Link href="/dashboard" className="group-data-[collapsible=icon]:hidden">
            <Image src="/logo.png" alt="App Logo" width={148} height={40} priority />
          </Link>
          <Link href="/dashboard" className="hidden group-data-[collapsible=icon]:block">
             <Image src="/logo.png" alt="App Logo" width={32} height={32} className="rounded-sm" priority />
          </Link>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden md:hidden" />
        </SidebarHeader>
        <SidebarContent className="flex-1">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border">
           <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center" onClick={handleLogout}>
            <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex-1 bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4 md:hidden">
           <SidebarTrigger />
           <Image src="/logo.png" alt="App Logo" width={120} height={32} priority />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
