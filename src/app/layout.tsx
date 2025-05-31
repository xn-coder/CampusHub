import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppLayout from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'CampusHub',
  description: 'School Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SidebarProvider defaultOpen>
          <AppLayout>{children}</AppLayout>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
