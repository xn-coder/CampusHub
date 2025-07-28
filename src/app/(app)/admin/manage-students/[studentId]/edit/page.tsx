
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ClassData, Student } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { FileEdit, UserCog, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateStudentAction } from '../../actions';

// This is a simplified fetcher. In a real app, you might have a dedicated server action.
async function getStudentAndClassData(studentId: string, schoolId: string): Promise<{ student: Student | null; classes: ClassData[] }> {
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single();
    
    if (studentError) {
        console.error("Error fetching student for edit:", studentError);
        return { student: null, classes: [] };
    }

    const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name, division')
        .eq('school_id', schoolId)
        .order('name');
    
    if (classesError) {
        console.error("Error fetching classes for edit:", classesError);
    }
    
    return { student: student as Student, classes: classes || [] };
}


export default function AdminEditStudentPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
  
  const [student, setStudent] = useState<Student | null>(null);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [classId, setClassId] = useState<string | undefined>('');


  useEffect(() => {
    async function loadContext() {
      if (!studentId) return;
      setIsFetchingInitialData(true);
      const adminUserId = localStorage.getItem('currentUserId');
      if (adminUserId) {
        const { data: userRec } = await supabase.from('users').select('school_id').eq('id', adminUserId).single();
        if (userRec?.school_id) {
            const { student, classes } = await getStudentAndClassData(studentId, userRec.school_id);
            if (student) {
                setStudent(student);
                setAllClasses(classes);
                // Pre-fill form
                setName(student.name);
                setEmail(student.email);
                setRollNumber(student.roll_number || '');
                setClassId(student.class_id || undefined);
            } else {
                toast({title: "Error", description: "Student not found.", variant: "destructive"});
                router.push('/admin/admissions');
            }
        }
      }
      setIsFetchingInitialData(false);
    }
    loadContext();
  }, [studentId, toast, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!student || !name || !email) {
      toast({ title: "Error", description: "Student's Name and Email are required.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    const result = await updateStudentAction({
        studentId: student.id,
        userId: student.user_id,
        schoolId: student.school_id,
        name: name,
        email: email,
        roll_number: rollNumber || null,
        class_id: classId || null
    });

    if (result.ok) {
      toast({ title: "Student Updated", description: result.message });
      router.push('/admin/admissions');
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  if (isFetchingInitialData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Student Admission" />
        <Card className="max-w-4xl mx-auto w-full">
            <CardContent className="pt-6 text-center flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading student data...
            </CardContent>
        </Card>
      </div>
    );
  }
  if (!student) {
    return (
       <div className="flex flex-col gap-6">
       <PageHeader title="Edit Student Admission" />
       <Card className="max-w-4xl mx-auto w-full">
            <CardContent className="pt-6 text-center text-destructive">
                Could not load student data. The student may not exist or you may not have permission to view them.
            </CardContent>
        </Card>
       </div>
   );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit Admission: ${student.name}`}
        description="Modify the details for this student."
      />
      <Card className="max-w-4xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FileEdit className="mr-2 h-5 w-5" />Student Details</CardTitle>
          <CardDescription>Update the student's core information and class assignment.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            
            <div className="space-y-4 border p-4 rounded-md">
              <h3 className="text-lg font-medium">Core Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label htmlFor="name">Student Full Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading}/></div>
                <div><Label htmlFor="email">Email Address (Login ID)</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading}/></div>
                <div><Label htmlFor="rollNumber">Roll Number (Optional)</Label><Input id="rollNumber" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} disabled={isLoading}/></div>
                <div>
                    <Label htmlFor="classSelect">Assign to Class</Label>
                    <Select value={classId} onValueChange={setClassId} disabled={isLoading || allClasses.length === 0}>
                        <SelectTrigger id="classSelect"><SelectValue placeholder="Select a class" /></SelectTrigger>
                        <SelectContent>{allClasses.length > 0 ? allClasses.map(cls => (<SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>)) : <SelectItem value="no-class" disabled>No classes found</SelectItem>}</SelectContent>
                    </Select>
                </div>
              </div>
            </div>
            
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserCog className="mr-2 h-4 w-4" /> }
                Save Changes
            </Button>
             <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
