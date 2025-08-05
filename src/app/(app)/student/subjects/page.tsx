
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Subject } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { BookOpenText, Layers, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudentSubjectsAction } from './actions';

interface EnrichedSubject extends Subject {
  academicYearName?: string;
}

export default function StudentSubjectsPage() {
  const { toast } = useToast();
  const [mySubjects, setMySubjects] = useState<EnrichedSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentSchoolId, setStudentSchoolId] = useState<string | null>(null);

  const fetchSubjectData = useCallback(async () => {
    setIsLoading(true);
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
      toast({ title: "Error", description: "User not identified.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const result = await getStudentSubjectsAction(currentUserId);
    if (result.ok) {
        setStudentSchoolId(result.schoolId || null);
        setMySubjects(result.subjects || []);
    } else {
        toast({ title: "Error", description: result.message || "Failed to load subjects.", variant: "destructive" });
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSubjectData();
  }, [fetchSubjectData]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Subjects" 
        description="View the subjects relevant to your current academic program." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/>Loading your subjects...</CardContent></Card>
      ) : !studentSchoolId ? (
        <Card><CardContent className="pt-6 text-center text-destructive">Could not determine your school. Subjects cannot be loaded.</CardContent></Card>
      ) : mySubjects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No subjects are currently listed for your school or program.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mySubjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpenText className="mr-2 h-5 w-5 text-primary" />
                  {subject.name}
                </CardTitle>
                <CardDescription>Code: {subject.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Layers className="mr-1 h-4 w-4" />
                  Academic Year: {subject.academicYearName || 'General'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
