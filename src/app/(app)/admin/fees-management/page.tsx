
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Layers, 
    Tags, 
    Group, 
    BadgePercent, 
    FileBadge, 
    IndianRupee, 
    LayoutGrid,
    Wallet,
    Receipt,
    Users
} from 'lucide-react';
import Link from 'next/link';

interface FeeManagementOption {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  isImplemented: boolean;
}

const feeConfigOptions: FeeManagementOption[] = [
  {
    id: "fee-categories",
    title: "Manage Fee Categories",
    description: "Define fee types like tuition, labs, etc.",
    icon: Tags,
    href: "/admin/fee-categories",
    isImplemented: true,
  },
  {
    id: "expense-categories",
    title: "Manage Expense Categories",
    description: "Define categories for school expenses.",
    icon: Wallet,
    href: "/admin/expense-categories",
    isImplemented: true,
  },
  {
    id: "installments",
    title: "Manage Installments",
    description: "Set up payment installment plans.",
    icon: Layers,
    href: "/admin/manage-installments",
    isImplemented: true,
  },
  {
    id: "fee-types",
    title: "Manage Fee Types",
    description: "Create specific fee variations.",
    icon: FileBadge,
    href: "/admin/manage-fee-types",
    isImplemented: true,
  },
  {
    id: "fee-groups",
    title: "Manage Fee Type Groups",
    description: "Group fee types for easier assignment.",
    icon: Group,
    href: "/admin/manage-fee-groups",
    isImplemented: true,
  },
  {
    id: "concessions",
    title: "Manage Concessions",
    description: "Define and apply fee discounts.",
    icon: BadgePercent,
    href: "/admin/manage-concessions",
    isImplemented: true,
  },
  {
    id: "fee-structures",
    title: "Manage Fee Structures",
    description: "Design fee structures for classes.",
    icon: LayoutGrid,
    href: "/admin/manage-fee-structures",
    isImplemented: true,
  },
   {
    id: "special-fees",
    title: "Manage Special Fee Types",
    description: "Handle one-off or unique fees.",
    icon: IndianRupee,
    href: "/admin/manage-special-fee-types",
    isImplemented: true,
  },
];

const feeReportOptions: FeeManagementOption[] = [
  {
    id: "student-fees-report",
    title: "Student Fee Records",
    description: "View, filter, and manage individual student fee assignments and payment statuses.",
    icon: Users,
    href: "/admin/student-fees",
    isImplemented: true,
  },
  {
    id: "expenses-report",
    title: "Expense Management",
    description: "Log, track, and generate reports for all school-related expenditures.",
    icon: Wallet,
    href: "/admin/expenses",
    isImplemented: true,
  },
  {
    id: "receipts-report",
    title: "Receipt Vouchers",
    description: "Generate and view all non-student fee related income receipts.",
    icon: Receipt,
    href: "/admin/receipts",
    isImplemented: true,
  },
];


export default function FeesManagementPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fees Management"
        description="A central hub for managing all fee-related activities, from configuration to reporting."
      />
      <Card>
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
          <CardDescription>
            Select a module below to configure different aspects of your school's fee structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeConfigOptions.map((option) => {
                    const CardWrapper = option.isImplemented ? Link : 'div';
                    return (
                        <CardWrapper key={option.id} href={option.href} className={option.isImplemented ? 'cursor-pointer' : 'cursor-not-allowed'}>
                           <Card className={`h-full transition-all ${option.isImplemented ? 'hover:border-primary hover:shadow-md' : 'bg-muted/50'}`}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-medium">{option.title}</CardTitle>
                                    <option.icon className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground">{option.description}</p>
                                    {!option.isImplemented && (
                                        <div className="text-xs font-semibold text-amber-600 mt-2">Coming Soon</div>
                                    )}
                                </CardContent>
                            </Card>
                        </CardWrapper>
                    )
                })}
            </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Fee Reports</CardTitle>
          <CardDescription>
            Generate and view detailed reports for various financial activities.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeReportOptions.map((option) => (
                    <Link key={option.id} href={option.href} className='cursor-pointer'>
                       <Card className="h-full transition-all hover:border-primary hover:shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">{option.title}</CardTitle>
                                <option.icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
