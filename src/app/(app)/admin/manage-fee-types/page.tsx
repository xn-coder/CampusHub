
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileBadge } from 'lucide-react';
import Link from 'next/link';

export default function ManageFeeTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Fee Types"
        description="This feature is under construction. It will allow you to create specific fee variations."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/fees-management">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Fees Management
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><FileBadge className="mr-2 h-5 w-5" />Fee Types</CardTitle>
          <CardDescription>
            The functionality to create, list, and assign fee types will be implemented here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Coming Soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
