
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Subject, Student, AcademicYear } from '@/types';
import { useState, useEffect } from 'react';
import { BookOpenText, Layers, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface EnrichedSubject extends Subject {
  academicYearName?: string;
}

export default function StudentSubjectsPage() {
  const { toast } = useToast();
  const [mySubjects, setMySubjects] = useState<EnrichedSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentSchoolId, setStudentSchoolId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjectData() {
      setIsLoading(true);
      const currentUserId = localStorage.getItem('currentUserId');
      if (!currentUserId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('school_id, class_id') // Also fetch class_id if needed for more specific subject filtering
          .eq('user_id', currentUserId)
          .single();

        if (studentError || !studentData || !studentData.school_id) {
          toast({ title: "Error", description: "Could not fetch student's school information.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        setStudentSchoolId(studentData.school_id);

        const [subjectsResult, academicYearsResult] = await Promise.all([
          supabase.from('subjects').select('*').eq('school_id', studentData.school_id),
          supabase.from('academic_years').select('*').eq('school_id', studentData.school_id)
        ]);

        if (subjectsResult.error) {
          toast({ title: "Error", description: "Failed to fetch subjects.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        
        const allSubjects: Subject[] = subjectsResult.data || [];
        const academicYears: AcademicYear[] = academicYearsResult.data || [];
        
        // Here you might add more complex logic to filter subjects based on studentData.class_id
        // For now, showing all school subjects with their academic year.
        const enrichedSubjects = allSubjects.map(sub => ({
            ...sub,
            academicYearName: sub.academic_year_id ? academicYears.find(ay => ay.id === sub.academic_year_id)?.name : 'General'
        }));
        
        setMySubjects(enrichedSubjects);

      } catch (error: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive"});
      } finally {
        setIsLoading(false);
      }
    }
    fetchSubjectData();
  }, [toast]);

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
