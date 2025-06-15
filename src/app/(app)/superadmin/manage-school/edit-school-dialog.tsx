
"use client";

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Edit2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { School } from '@prisma/client';
import { updateSchoolAction } from './actions';

interface EditSchoolDialogProps {
  school: School;
}

export default function EditSchoolDialog({ school }: EditSchoolDialogProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editSchoolName, setEditSchoolName] = useState(school.name);
  const [editSchoolAddress, setEditSchoolAddress] = useState(school.address);
  const [isLoading, setIsLoading] = useState(false);

  const handleEditSchoolSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!editSchoolName.trim() || !editSchoolAddress.trim()) {
      toast({ title: "Error", description: "School Name and Address cannot be empty.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const result = await updateSchoolAction({
      id: school.id,
      name: editSchoolName.trim(),
      address: editSchoolAddress.trim(),
    });

    if (result.ok) {
      toast({ title: "School Updated", description: result.message });
      setIsDialogOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Edit School">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit School: {school.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSchoolSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editSchoolName" className="text-right">School Name</Label>
              <Input 
                id="editSchoolName" 
                value={editSchoolName} 
                onChange={(e) => setEditSchoolName(e.target.value)} 
                className="col-span-3" 
                required 
                disabled={isLoading}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editSchoolAddress" className="text-right">Address</Label>
              <Input 
                id="editSchoolAddress" 
                value={editSchoolAddress} 
                onChange={(e) => setEditSchoolAddress(e.target.value)} 
                className="col-span-3" 
                required 
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
