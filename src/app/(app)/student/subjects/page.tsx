
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Subject, Student, ClassData, AcademicYear } from '@/types';
import { useState, useEffect } from 'react';
import { BookOpenText, Layers } from 'lucide-react';

const MOCK_SUBJECTS_KEY = 'mockSubjectsData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_ACADEMIC_YEARS_KEY = 'mockAcademicYearsData';

interface EnrichedSubject extends Subject {
  academicYearName?: string;
}

export default function StudentSubjectsPage() {
  const [mySubjects, setMySubjects] = useState<EnrichedSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const currentUserId = localStorage.getItem('currentUserId');
      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      const allStudents: Student[] = storedStudents ? JSON.parse(storedStudents) : [];
      const currentStudent = allStudents.find(s => s.id === currentUserId);

      if (currentStudent?.classId) {
        const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
        const allClasses: ClassData[] = storedClasses ? JSON.parse(storedClasses) : [];
        // For simplicity, we'll assume student's class isn't directly tied to an academic year for subject listing.
        // We'll list all subjects or subjects from a general/current academic year if defined.
        // This part can be refined if classes are linked to academic years.

        const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
        const allSubjects: Subject[] = storedSubjects ? JSON.parse(storedSubjects) : [];
        
        const storedAcademicYears = localStorage.getItem(MOCK_ACADEMIC_YEARS_KEY);
        const academicYears: AcademicYear[] = storedAcademicYears ? JSON.parse(storedAcademicYears) : [];

        // A more sophisticated logic might filter subjects based on the student's specific class curriculum.
        // For now, display all general subjects, or filter by a "current" academic year if one is identifiable.
        // Let's assume for now they see all subjects that don't have a specific academic year or match a general "current" one.
        // This part is simplified for mock data.
        const enrichedSubjects = allSubjects.map(sub => ({
            ...sub,
            academicYearName: sub.academicYearId ? academicYears.find(ay => ay.id === sub.academicYearId)?.name : 'General'
        }));

        setMySubjects(enrichedSubjects);

      } else {
        setMySubjects([]); // No class assigned, so no specific subjects to show yet.
      }
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="My Subjects" 
        description="View the subjects relevant to your current academic program." 
      />
      {isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Loading your subjects...</CardContent></Card>
      ) : mySubjects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No subjects are currently listed for you. This might be because you are not assigned to a class, or subjects haven't been configured for your program.</CardContent></Card>
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
                {/* Placeholder for teacher name or more details */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
