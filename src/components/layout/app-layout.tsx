"use client";

import type React from 'react';
import { Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar variant="sidebar" collapsible="icon" side="left">
        <SidebarHeader className="p-4 flex items-center justify-between">
          <h1 className="text-2xl font-headline font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
            CampusHub
          </h1>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden md:hidden" />
        </SidebarHeader>
        <SidebarContent className="flex-1">
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar-border">
           <Button variant="ghost" className="w-full justify-start group-data-[collapsible=icon]:justify-center">
            <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex-1 bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4 md:hidden">
           <SidebarTrigger />
           <h1 className="text-xl font-headline font-bold text-primary">CampusHub</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
