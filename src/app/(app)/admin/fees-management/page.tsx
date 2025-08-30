
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
    id: "fee-types",
    title: "Manage Fee Types",
    description: "Create specific fee variations, like 'Late Fee' or 'Annual Fee'.",
    icon: FileBadge,
    href: "/admin/manage-fee-types",
    isImplemented: true,
  },
  {
    id: "special-fee-types",
    title: "Manage Special Fee Types",
    description: "Handle one-off charges like 'event fee' or 're-exam fee'.",
    icon: FileBadge,
    href: "/admin/manage-special-fee-types",
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
    id: "installments",
    title: "Manage Installments",
    description: "Set up payment installment plans.",
    icon: Layers,
    href: "/admin/manage-installments",
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* Dues Reports Column */}
                <div className="col-span-1">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Dues Reports</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                        <Link href="/admin/student-fees?period=this_year&status=Unpaid" className="text-primary hover:underline">Yearly Head-Wise Dues Summary</Link>
                        <Link href="/admin/student-fees?status=Unpaid" className="text-primary hover:underline">Outstanding Due Summary</Link>
                        <Link href="/admin/student-fees?status=Unpaid" className="text-primary hover:underline">Class Wise Outstanding Dues</Link>
                        <Link href="/admin/student-fees?status=Unpaid" className="text-primary hover:underline">Complete Outstanding Dues</Link>
                        <Link href="/admin/student-fees" className="text-primary hover:underline">All Students Fee Report</Link>
                        <span className="text-muted-foreground cursor-not-allowed">Consolidated Dues Report (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Fee Student Follow Up (Soon)</span>
                    </div>
                </div>
                 {/* Collection Reports Column */}
                <div className="col-span-1">
                    <h3 className="text-lg font-semibold text-green-600 mb-2">Collection Reports</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                         <Link href="/admin/student-fees?period=today&status=Paid" className="text-primary hover:underline">Daily Collection Report</Link>
                         <Link href="/admin/student-fees?status=Paid" className="text-primary hover:underline">Date-wise Collection</Link>
                         <Link href="/admin/student-fees?status=Paid" className="text-primary hover:underline">Head Wise Collection</Link>
                         <span className="text-muted-foreground cursor-not-allowed">Deleted Fee Collection (Soon)</span>
                         <span className="text-muted-foreground cursor-not-allowed">Cashier-wise Collection (Soon)</span>
                         <Link href="/admin/student-fees?period=this_year&status=Paid" className="text-primary hover:underline">Yearly Collection Report</Link>
                         <Link href="/admin/student-fees?status=Paid" className="text-primary hover:underline">Consolidated Collection Report</Link>
                    </div>
                </div>
                {/* General Reports Column */}
                <div className="col-span-1">
                    <h3 className="text-lg font-semibold text-blue-600 mb-2">General Reports</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                        <Link href="/admin/student-fees" className="text-primary hover:underline">All Fee Transactions</Link>
                        <span className="text-muted-foreground cursor-not-allowed">Fee Ledger Book (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Concession Report (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Fee Type/Group Wise Report (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Fee Defaulter List (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Fee Structure Report (Soon)</span>
                    </div>
                </div>
                 {/* Student Reports Column */}
                <div className="col-span-1">
                    <h3 className="text-lg font-semibold text-purple-600 mb-2">Student Reports</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                        <span className="text-muted-foreground cursor-not-allowed">Student Fee Card (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Student Ledger (Soon)</span>
                        <span className="text-muted-foreground cursor-not-allowed">Student Fee Receipt (Soon)</span>
                         <span className="text-muted-foreground cursor-not-allowed">Student Hostel Report (Soon)</span>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
