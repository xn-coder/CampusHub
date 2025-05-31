"use client"; 

import { SidebarProvider } from '@/components/ui/sidebar';
import AppLayout from '@/components/layout/app-layout';
import type React from 'react';

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppLayout>{children}</AppLayout>
    </SidebarProvider>
  );
}
