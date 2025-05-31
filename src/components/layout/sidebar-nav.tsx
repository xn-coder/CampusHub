"use client";

import type { NavItem } from '@/types';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  School,
  ClipboardEdit,
  Users,
  Presentation,
  Megaphone,
  CalendarDays,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/school-details', label: 'School Details', icon: School },
  { href: '/leave-application', label: 'Leave Application', icon: ClipboardEdit },
  { href: '/student-profile', label: 'Student Profiles', icon: Users },
  { href: '/class-management', label: 'Class Management', icon: Presentation },
  { href: '/communication', label: 'Communication', icon: Megaphone },
  { href: '/calendar-events', label: 'Calendar & Events', icon: CalendarDays },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.label}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(item.href)}
              tooltip={{ children: item.label, side: 'right', align: 'center' }}
            >
              <a>
                <item.icon />
                <span>{item.label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
