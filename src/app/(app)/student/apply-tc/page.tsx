
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FileCertificate, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { requestTransferCertificateAction } from './actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function ApplyForTCPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  
  const [resultMessage, setResultMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    async function loadUserContext() {
      setIsPageLoading(true);
      const userId = localStorage.getItem('currentUserId');
      if (!userId) {
        toast({ title: "Error", description: "User not identified.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }

      const { data: studentProfile, error } = await supabase
        .from('students')
        .select('id, school_id')
        .eq('user_id', userId)
        .single();
      
      if (error || !studentProfile) {
        toast({ title: "Error", description: "Could not load your student profile.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      
      setCurrentStudentId(studentProfile.id);
      setCurrentSchoolId(studentProfile.school_id);
      setIsPageLoading(false);
    }
    loadUserContext();
  }, [toast]);


  const handleRequestTC = async () => {
    if (!currentStudentId || !currentSchoolId) {
      toast({ title: "Error", description: "Your profile or school information is missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResultMessage(null);

    const result = await requestTransferCertificateAction(currentStudentId, currentSchoolId);
    if (result.ok) {
        toast({ title: "Request Submitted", description: result.message });
        setResultMessage({ type: 'success', text: result.message });
    } else {
        toast({ title: "Request Failed", description: result.message, variant: "destructive", duration: 10000 });
        setResultMessage({ type: 'error', text: result.message });
    }
    setIsLoading(false);
  };

  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Apply for Transfer Certificate" />
            <Card className="max-w-2xl mx-auto w-full">
                <CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading your information...
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Apply for Transfer Certificate" 
        description="Submit a request to the school administration to issue your TC." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FileCertificate className="mr-2 h-5 w-5" /> TC Request</CardTitle>
          <CardDescription>
            Before you can apply for a Transfer Certificate, you must ensure all outstanding school fees are cleared.
            Click the button below to check your fee status and submit your request. The administration will be notified.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {resultMessage && (
                <Alert variant={resultMessage.type === 'success' ? 'default' : 'destructive'}>
                    <AlertTitle>{resultMessage.type === 'success' ? "Success!" : "Action Required"}</AlertTitle>
                    <AlertDescription>{resultMessage.text}</AlertDescription>
                </Alert>
            )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleRequestTC} disabled={isLoading || isPageLoading || resultMessage?.type === 'success'} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCertificate className="mr-2 h-4 w-4" />}
            {isLoading ? 'Checking fees and submitting...' : 'Request Transfer Certificate'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
