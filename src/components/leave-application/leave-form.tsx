
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, UploadCloud } from 'lucide-react';
import type { User, Student, UserRole, SchoolEntry, StoredLeaveApplicationDB, Teacher } from '@/types';
import { submitLeaveApplicationAction } from '@/actions/leaveActions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { fileToDataUri } from '@/lib/utils';

const formSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters long"),
  medicalNotes: z.any().optional(),
});

type LeaveFormValues = z.infer<typeof formSchema>;

export default function LeaveForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<StoredLeaveApplicationDB | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [studentProfile, setStudentProfile] = useState<Student | null>(null);
  const [teacherProfile, setTeacherProfile] = useState<Teacher | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);


  const { control, handleSubmit, register, formState: { errors }, reset, setValue } = useForm<LeaveFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicantName: '',
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
          const { data: userRec, error: userErr } = await supabase.from('users').select('school_id, name').eq('id', userId).single();
          if (userErr || !userRec) {
            toast({title: "Error", description: "Could not determine user's school.", variant: "destructive"});
            return;
          }
          setCurrentSchoolId(userRec.school_id);
          
          if (role === 'student') {
            const { data: studentData, error: studentError } = await supabase.from('students').select('*').eq('user_id', userId).single();
            if (studentError || !studentData) {
              toast({title: "Error", description: "Could not load student profile.", variant: "destructive"});
            } else {
              setStudentProfile(studentData as Student);
              setValue('applicantName', studentData.name);
            }
          } else if (role === 'teacher') {
            const { data: teacherData, error: teacherError } = await supabase.from('teachers').select('*').eq('user_id', userId).single();
            if (teacherError || !teacherData) {
              toast({title: "Error", description: "Could not load teacher profile.", variant: "destructive"});
            } else {
              setTeacherProfile(teacherData as Teacher);
              setValue('applicantName', teacherData.name);
            }
          }
        }
      }
    }
    loadUserContext();
  }, [setValue, toast]);


  const onSubmit = async (data: LeaveFormValues) => {
    setIsLoading(true);
    setSubmissionResult(null);
    setError(null);

    if (!currentUserId || !currentUserRole || !currentSchoolId) {
      setError("User context or school ID is missing. Cannot submit application.");
      setIsLoading(false);
      return;
    }

    try {
      let medicalNotesDataUri: string | undefined = undefined;
      if (data.medicalNotes && data.medicalNotes[0]) {
        try {
          medicalNotesDataUri = await fileToDataUri(data.medicalNotes[0]);
        } catch (e) {
          setError("Failed to read the medical notes file.");
          toast({ title: "File Error", description: "Could not process the uploaded file.", variant: "destructive"});
          setIsLoading(false);
          return;
        }
      }

      const result = await submitLeaveApplicationAction({
        student_name: data.applicantName, // This field serves as the applicant's name
        reason: data.reason,
        medical_notes_data_uri: medicalNotesDataUri,
        student_profile_id: studentProfile?.id,
        applicant_user_id: currentUserId,
        applicant_role: currentUserRole,
        school_id: currentSchoolId,
      });

      if (result.ok && result.application) {
        setSubmissionResult(result.application);
        toast({ title: "Application Submitted", description: result.message});
        
        const resetValues = { reason: '', medicalNotes: undefined, applicantName: data.applicantName };
        reset(resetValues);
        setFileName(null); 
      } else {
        setError(result.message || "Failed to save application to database.");
        toast({ title: "Submission Error", description: result.message || "Failed to save application.", variant: "destructive"});
      }
      
    } catch (e: any) {
      console.error("Error during submission action:", e);
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
        <CardDescription>Fill in the details for your leave request. Your application will be reviewed by the administration.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="applicantName">Applicant Name</Label>
            <Controller
              name="applicantName"
              control={control}
              render={({ field }) => <Input id="applicantName" placeholder="Enter your full name" {...field} disabled={(currentUserRole === 'student' && !!studentProfile) || (currentUserRole === 'teacher' && !!teacherProfile)} />}
            />
            {errors.applicantName && <p className="text-sm text-destructive mt-1">{errors.applicantName.message}</p>}
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
            <Label htmlFor="medicalNotes">Upload Document (Optional)</Label>
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
                Submitting...
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

        {submissionResult && (
          <Alert className="mt-6" variant={submissionResult.status === 'Approved' ? "default" : "destructive"}>
             {submissionResult.status === 'Approved' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4"/>}
            <AlertTitle>Application Status: {submissionResult.status}</AlertTitle>
            <AlertDescription>
                <p>Your application has been submitted and is now pending review.</p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
