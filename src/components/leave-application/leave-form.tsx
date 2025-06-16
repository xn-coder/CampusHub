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
import type { User, Student, UserRole, SchoolEntry } from '@/types';
import { submitLeaveApplicationAction } from '@/app/(app)/leave-application/actions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';


const formSchema = z.object({
  studentName: z.string().min(1, "Student name is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters long"),
  medicalNotes: z.any().optional(),
});

type LeaveFormValues = z.infer<typeof formSchema>;

export default function LeaveForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<LeaveApplicationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null); // For logged-in student
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  const { control, handleSubmit, register, formState: { errors }, reset, watch, setValue } = useForm<LeaveFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentName: '',
      reason: '',
    }
  });
  
  useEffect(() => {
    async function loadUserContext() {
      if (typeof window !== 'undefined') {
        const role = localStorage.getItem('currentUserRole') as UserRole | null;
        const userId = localStorage.getItem('currentUserId'); // This is User.id
        setCurrentUserRole(role);
        setCurrentUserId(userId);

        if (userId) {
          // Fetch school_id from the user's record
          const { data: userRec, error: userErr } = await supabase
            .from('users')
            .select('school_id, name')
            .eq('id', userId)
            .single();
          
          if (userErr || !userRec) {
            toast({title: "Error", description: "Could not determine user's school.", variant: "destructive"});
            return;
          }
          setCurrentSchoolId(userRec.school_id);

          if (role === 'student') {
            const { data: studentData, error: studentError } = await supabase
              .from('students')
              .select('*')
              .eq('user_id', userId) // Student profile linked by User.id
              .single();
            if (studentError || !studentData) {
              toast({title: "Error", description: "Could not load student profile.", variant: "destructive"});
            } else {
              setStudentProfile(studentData as Student);
              setValue('studentName', studentData.name); // Pre-fill student name
            }
          } else {
             // For admin/teacher, they might be applying for a student, so studentName is manual
             // Or we could add a student selector if they are applying for others
             // For now, studentName is manually entered by admin/teacher if not student themselves
          }
        }
      }
    }
    loadUserContext();
  }, [setValue, toast]);


  const medicalNotesFileList = watch("medicalNotes");

  const onSubmit = async (data: LeaveFormValues) => {
    setIsLoading(true);
    setAiResponse(null);
    setError(null);

    if (!currentUserId || !currentUserRole || !currentSchoolId) {
      setError("User context or school ID is missing. Cannot submit application.");
      setIsLoading(false);
      return;
    }
    
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

      const submissionResult = await submitLeaveApplicationAction({
        student_profile_id: studentProfile?.id, // Logged-in student's profile ID
        student_name: data.studentName, // Name from form (pre-filled for student)
        reason: data.reason,
        medical_notes_data_uri: medicalNotesDataUri,
        status: response.approved ? 'Approved' : 'Rejected',
        ai_reasoning: response.reasoning,
        applicant_user_id: currentUserId,
        applicant_role: currentUserRole,
        school_id: currentSchoolId,
      });

      if (submissionResult.ok) {
        toast({ title: "Application Submitted", description: "Your leave application has been processed and recorded."});
        const resetValues = { reason: '', medicalNotes: undefined };
        if(currentUserRole === 'student' && studentProfile) {
          reset({...resetValues, studentName: studentProfile.name });
        } else {
          reset({...resetValues, studentName: ''});
        }
        setFileName(null); 
      } else {
        setError(submissionResult.message || "Failed to save application to database.");
        toast({ title: "Submission Error", description: submissionResult.message || "Failed to save application.", variant: "destructive"});
      }
      
    } catch (e: any) {
      console.error("AI or DB processing error:", e);
      setError(e.message || "An error occurred while processing your application.");
      toast({ title: "Processing Error", description: e.message || "An error occurred.", variant: "destructive"});
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
              render={({ field }) => <Input id="studentName" placeholder="Enter student's full name" {...field} disabled={currentUserRole === 'student' && !!studentProfile} />}
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

          <Button type="submit" disabled={isLoading || !currentSchoolId} className="w-full">
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
