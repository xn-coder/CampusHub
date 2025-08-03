
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Search as SearchIcon, ArrowDownUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { SchoolEntry as School } from '@/types'; 
import EditSchoolDialog from './edit-school-dialog'; 
import DeleteSchoolButton from './delete-school-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

export default function ManageSchoolPage() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof School | null>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const getSchools = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('schools').select(`
        id,
        name,
        address,
        admin_email,
        admin_name,
        status,
        admin_user_id,
        created_at
      `); 

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error("Failed to fetch schools from Supabase:", error);
        toast({ title: "Error", description: "Failed to fetch schools.", variant: "destructive"});
        setSchools([]);
      } else {
        setSchools((data || []).map(item => ({
          id: item.id,
          name: item.name,
          address: item.address,
          admin_email: item.admin_email,
          admin_name: item.admin_name,
          status: item.status as 'Active' | 'Inactive',
          admin_user_id: item.admin_user_id,
          created_at: item.created_at, 
        })));
      }
    } catch (error) {
      console.error("Unexpected error fetching schools:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive"});
      setSchools([]);
    }
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    getSchools();
    // This will refetch data when the user navigates back to the page.
    const handleFocus = () => getSchools();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [getSchools]);
  
  const handleSort = (column: keyof School) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };
  
  const filteredAndSortedSchools = useMemo(() => {
    let filtered = [...schools];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(school => 
        school.name.toLowerCase().includes(lowercasedTerm) ||
        (school.admin_name && school.admin_name.toLowerCase().includes(lowercasedTerm)) ||
        (school.admin_email && school.admin_email.toLowerCase().includes(lowercasedTerm))
      );
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    
    return filtered;
  }, [schools, searchTerm, sortBy, sortOrder]);

  const paginatedSchools = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedSchools.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedSchools, currentPage]);
  
  const totalPages = Math.ceil(filteredAndSortedSchools.length / ITEMS_PER_PAGE);

  const SortableHeader = ({ column, label }: { column: keyof School; label: string }) => (
    <TableHead onClick={() => handleSort(column)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center gap-2">
        {label}
        {sortBy === column && <ArrowDownUp className="h-4 w-4" />}
      </div>
    </TableHead>
  );


  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manage Schools"
        description="View, edit, or deactivate schools in the system."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5" /> Registered Schools</CardTitle>
          <CardDescription>A list of all schools currently in the CampusHub system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2 max-w-lg">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by school name, principal name, or principal email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="flex-grow"
              disabled={isLoading}
            />
          </div>
          {isLoading ? (
             <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : paginatedSchools.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {searchTerm ? `No schools match your search for "${searchTerm}".` : 'No schools registered yet.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name" label="School Name" />
                  <SortableHeader column="address" label="Address" />
                  <SortableHeader column="admin_name" label="Principal Name" />
                  <SortableHeader column="admin_email" label="Principal Email" />
                  <SortableHeader column="status" label="Status" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSchools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.address}</TableCell>
                    <TableCell>{school.admin_name}</TableCell>
                    <TableCell>{school.admin_email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        school.status === 'Active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {school.status}
                      </span>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <EditSchoolDialog school={school} />
                      <DeleteSchoolButton schoolId={school.id} schoolName={school.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex justify-end items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                </Button>
            </CardFooter>
          )}
      </Card>
    </div>
  );
}
