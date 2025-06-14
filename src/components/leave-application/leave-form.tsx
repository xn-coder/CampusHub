
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fileToDataUri } from '@/lib/utils';
import { leaveApplicationApproval, type LeaveApplicationInput, type LeaveApplicationOutput } from '@/ai/flows/leave-application-approval';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, UploadCloud } from 'lucide-react';
import type { User, Student, UserRole } from '@/types'; // Import User and Student types

const MOCK_ALL_LEAVE_APPLICATIONS_KEY = 'mockAllLeaveApplicationsData';
const MOCK_USER_DB_KEY = 'mockUserDatabase';
const MOCK_STUDENTS_KEY = 'mockStudentsData';


interface StoredLeaveApplication extends LeaveApplicationInput {
  id: string;
  studentName: string; // The name entered in the form
  studentId?: string; // ID of the student if logged in as student
  applicantRole: UserRole | 'guest';
  submissionDate: string; // ISO string
  status: 'Pending AI Review' | 'Approved' | 'Rejected';
  aiReasoning?: string;
}


const formSchema = z.object({
  studentName: z.string().min(1, "Student name is required"), // This could be pre-filled if user is logged in as student
  reason: z.string().min(10, "Reason must be at least 10 characters long"),
  medicalNotes: z.any().optional(),
});

type LeaveFormValues = z.infer<typeof formSchema>;

export default function LeaveForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<LeaveApplicationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);


  const { control, handleSubmit, register, formState: { errors }, reset, watch, setValue } = useForm<LeaveFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentName: '',
      reason: '',
    }
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('currentUserRole') as UserRole | null;
      const userId = localStorage.getItem('currentUserId');
      setCurrentUserRole(role);
      setCurrentUserId(userId);

      if (role === 'student' && userId) {
        const users: User[] = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]');
        const studentUser = users.find(u => u.id === userId);
        if (studentUser) {
          setValue('studentName', studentUser.name); // Pre-fill student name
          setCurrentUserName(studentUser.name);
        }
      } else if (userId) { // For admin/teacher, get their name for record-keeping if they apply for someone
         const users: User[] = JSON.parse(localStorage.getItem(MOCK_USER_DB_KEY) || '[]');
         const applierUser = users.find(u => u.id === userId);
         if(applierUser) setCurrentUserName(applierUser.name);
      }
    }
  }, [setValue]);


  const medicalNotesFileList = watch("medicalNotes");

  const onSubmit = async (data: LeaveFormValues) => {
    setIsLoading(true);
    setAiResponse(null);
    setError(null);

    let medicalNotesDataUri: string | undefined = undefined;
    if (data.medicalNotes && data.medicalNotes.length > 0) {
      try {
        medicalNotesDataUri = await fileToDataUri(data.medicalNotes[0]);
      } catch (e) {
        setError("Failed to process medical note file.");
        setIsLoading(false);
        return;
      }
    }

    const aiInput: LeaveApplicationInput = {
      reason: data.reason,
      medicalNotesDataUri: medicalNotesDataUri,
    };

    try {
      const response = await leaveApplicationApproval(aiInput);
      setAiResponse(response);

      // Save to localStorage
      const storedApplications: StoredLeaveApplication[] = JSON.parse(localStorage.getItem(MOCK_ALL_LEAVE_APPLICATIONS_KEY) || '[]');
      const newApplication: StoredLeaveApplication = {
        id: `leave-${Date.now()}`,
        studentName: data.studentName, // Name from the form
        studentId: currentUserRole === 'student' ? currentUserId || undefined : undefined, // Actual student ID if student applied
        reason: data.reason,
        medicalNotesDataUri: medicalNotesDataUri,
        submissionDate: new Date().toISOString(),
        status: response.approved ? 'Approved' : 'Rejected',
        aiReasoning: response.reasoning,
        applicantRole: currentUserRole || 'guest', // Role of person submitting
      };
      storedApplications.unshift(newApplication); // Add to top
      localStorage.setItem(MOCK_ALL_LEAVE_APPLICATIONS_KEY, JSON.stringify(storedApplications));
      
      // Reset form, but keep student name if they are a student
      const resetValues = { reason: '', medicalNotes: undefined };
      if(currentUserRole === 'student' && currentUserName) {
        reset({...resetValues, studentName: currentUserName });
      } else {
        reset({...resetValues, studentName: ''});
      }
      setFileName(null); 
    } catch (e) {
      console.error("AI processing error:", e);
      setError("An error occurred while processing your application.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
    } else {
      setFileName(null);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Leave Application</CardTitle>
        <CardDescription>Fill in the details for your leave request. The system will review it based on school policy. All submissions are recorded.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="studentName">Student Name</Label>
            <Controller
              name="studentName"
              control={control}
              render={({ field }) => <Input id="studentName" placeholder="Enter student's full name" {...field} disabled={currentUserRole === 'student'} />}
            />
            {errors.studentName && <p className="text-sm text-destructive mt-1">{errors.studentName.message}</p>}
          </div>

          <div>
            <Label htmlFor="reason">Reason for Absence</Label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => <Textarea id="reason" placeholder="Explain the reason for absence..." {...field} />}
            />
            {errors.reason && <p className="text-sm text-destructive mt-1">{errors.reason.message}</p>}
          </div>

          <div>
            <Label htmlFor="medicalNotes">Medical Notes (Optional)</Label>
            <div className="flex items-center space-x-2">
              <Label 
                htmlFor="medicalNotes-upload" 
                className="flex items-center justify-center w-full px-4 py-2 border border-dashed rounded-md cursor-pointer hover:border-primary"
              >
                <UploadCloud className="w-5 h-5 mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {fileName || "Click to upload a file (PDF, JPG, PNG)"}
                </span>
              </Label>
              <Input 
                id="medicalNotes-upload" 
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                {...register("medicalNotes", { onChange: handleFileChange })}
              />
            </div>
            {errors.medicalNotes && <p className="text-sm text-destructive mt-1">{errors.medicalNotes.message?.toString()}</p>}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing & Recording...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {aiResponse && (
          <Alert className="mt-6" variant={aiResponse.approved ? "default" : "destructive"}>
            {aiResponse.approved ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <AlertTitle>Application {aiResponse.approved ? 'Approved' : 'Rejected'}</AlertTitle>
            <AlertDescription>{aiResponse.reasoning}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
