

"use client";

import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { deleteSchoolAction } from './actions';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteSchoolButtonProps {
  schoolId: string;
  schoolName: string;
}

export default function DeleteSchoolButton({ schoolId, schoolName }: DeleteSchoolButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    const result = await deleteSchoolAction(schoolId);
    if (result.ok) {
      toast({ title: "School Deleted", description: `School "${schoolName}" has been deleted.` });
    } else {
      toast({ title: "Error Deleting School", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
    setIsAlertOpen(false); // Close alert dialog
  };

  return (
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" title="Delete School" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the school record for "{schoolName}". 
            Associated principal user accounts will NOT be deleted automatically.
            Ensure all dependent data (classes, students, etc.) for this school is handled or removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isLoading} className="bg-destructive hover:bg-destructive/90">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete School
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
