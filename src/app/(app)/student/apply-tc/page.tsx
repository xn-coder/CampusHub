
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, CheckCircle, Clock, XCircle, Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { requestTransferCertificateAction, getStudentTCRequestStatusAction } from './actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { TCRequest } from '@/types';
import { useRouter } from 'next/navigation';


export default function ApplyForTCPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<TCRequest | null>(null);
  
  const [actionResultMessage, setActionResultMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const loadStudentAndRequestData = useCallback(async () => {
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
    
    if (studentProfile.id && studentProfile.school_id) {
        const statusResult = await getStudentTCRequestStatusAction(studentProfile.id, studentProfile.school_id);
        if(statusResult.ok) {
            setExistingRequest(statusResult.request || null);
        }
    }
    setIsPageLoading(false);
  }, [toast]);
  
  useEffect(() => {
    loadStudentAndRequestData();
  }, [loadStudentAndRequestData]);


  const handleRequestTC = async () => {
    if (!currentStudentId || !currentSchoolId) {
      toast({ title: "Error", description: "Your profile or school information is missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setActionResultMessage(null);

    const result = await requestTransferCertificateAction(currentStudentId, currentSchoolId);
    if (result.ok) {
        toast({ title: "Certificate Issued", description: result.message });
        loadStudentAndRequestData(); // Re-fetch the status
    } else {
        toast({ title: "Request Failed", description: result.message, variant: "destructive", duration: 10000 });
        setActionResultMessage({ type: 'error', text: result.message });
    }
    setIsLoading(false);
  };

  const renderStatusCard = () => {
    if (!existingRequest) return null;

    if (existingRequest.status === 'Pending') { // This case is less likely now but kept for safety
        return (
            <Alert variant="default" className="border-yellow-500 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400">
                <Clock className="h-4 w-4 !text-yellow-600" />
                <AlertTitle>Request Pending</AlertTitle>
                <AlertDescription>Your request is pending administrative approval.</AlertDescription>
            </Alert>
        );
    }
    if (existingRequest.status === 'Approved') {
        return (
             <Alert variant="default" className="border-green-500 text-green-700 dark:border-green-600 dark:text-green-300">
                <CheckCircle className="h-4 w-4 !text-green-600" />
                <AlertTitle>Certificate Issued!</AlertTitle>
                <AlertDescription>
                    Your Transfer Certificate is ready.
                     <Button 
                        variant="link" 
                        className="p-0 pl-1 h-auto font-bold" 
                        onClick={() => router.push(`/admin/transfer-certificate?studentId=${currentStudentId}`)}
                     >
                        Click here to view and download.
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }
    if (existingRequest.status === 'Rejected') {
         return (
            <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Request Rejected</AlertTitle>
                <AlertDescription>
                    <strong>Reason:</strong> {existingRequest.rejection_reason || 'No reason provided.'}
                    <p className="text-xs mt-1">Please contact the administration for more details.</p>
                </AlertDescription>
            </Alert>
        );
    }
    return null;
  }

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
        description="Submit a request to issue your TC. This will be automatically approved if all your fees are cleared." 
      />
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> TC Request</CardTitle>
          <CardDescription>
            Before you can apply, you must ensure all outstanding school fees are cleared.
            Click the button below to check your fee status and request your certificate.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {existingRequest ? renderStatusCard() : (
                actionResultMessage && actionResultMessage.type === 'error' && (
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Action Required</AlertTitle>
                        <AlertDescription>{actionResultMessage.text}</AlertDescription>
                    </Alert>
                )
            )}
        </CardContent>
        <CardFooter>
          {!existingRequest && (
            <Button onClick={handleRequestTC} disabled={isLoading || isPageLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}
              {isLoading ? 'Checking fees and issuing...' : 'Request & Generate Certificate'}
            </Button>
          )}
          {existingRequest?.status === 'Approved' && (
             <Button onClick={() => router.push(`/admin/transfer-certificate?studentId=${currentStudentId}`)} className="w-full">
                <Download className="mr-2 h-4 w-4"/> View My Certificate
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
