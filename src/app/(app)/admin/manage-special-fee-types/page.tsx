"use client";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Ban } from 'lucide-react';
import PageHeader from '@/components/shared/page-header';

export default function ManageSpecialFeeTypesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Manage Special Fee Types" />
      <Alert variant="default" className="border-amber-500 text-amber-700 dark:border-amber-700 dark:text-amber-400">
        <Ban className="h-4 w-4 !text-amber-600" />
        <AlertTitle>Feature Under Construction</AlertTitle>
        <AlertDescription>
          The "Manage Special Fee Types" feature is currently being built and is not yet available.
        </AlertDescription>
      </Alert>
    </div>
  );
}
