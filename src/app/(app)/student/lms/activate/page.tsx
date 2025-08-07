

"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Course, UserRole } from '@/types';
import { useState, useEffect, type FormEvent, useCallback, Suspense, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, CheckCircle, XCircle, Loader2, CreditCard } from 'lucide-react';
import Script from 'next/script';
import { 
  getCourseActivationPageInitialDataAction, 
  activateCourseWithCodeAction,
  createCoursePaymentOrderAction,
  verifyCoursePaymentAndEnrollAction
} from '@/app/(app)/admin/lms/courses/actions';
import { Separator } from '@/components/ui/separator';

declare global {
  interface Window {
    Razorpay: new (options: any) => any;
  }
}

function ActivateLmsForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activationCode, setActivationCode] = useState('');
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); 
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null); 
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const fetchInitialPageData = useCallback(async () => {
    setIsPageLoading(true);
    const courseIdFromQuery = searchParams.get('courseId');
    const userIdFromStorage = localStorage.getItem('currentUserId');
    const userNameFromStorage = localStorage.getItem('currentUserName');
    const userEmailFromStorage = localStorage.getItem('currentUserEmail'); // Assuming email is stored

    if (!userIdFromStorage) {
      toast({ title: "Error", description: "User not identified. Please log in.", variant: "destructive"});
      setIsPageLoading(false);
      return;
    }
    setCurrentUserId(userIdFromStorage);
    setCurrentUserName(userNameFromStorage);
    if (userEmailFromStorage) setCurrentUserEmail(userEmailFromStorage);

    const result = await getCourseActivationPageInitialDataAction(courseIdFromQuery, userIdFromStorage);

    if (result.ok && result.data) {
      setTargetCourse(result.data.targetCourse || null);
      setCurrentUserProfileId(result.data.userProfileId || null);
      setCurrentSchoolId(result.data.userSchoolId || null);
      setCurrentUserRole(result.data.userRole || null);
    } else {
      toast({ title: "Error Loading Page Data", description: result.message || "Failed to load initial page data.", variant: "destructive"});
    }
    setIsPageLoading(false);
  }, [searchParams, toast]);

  useEffect(() => {
    fetchInitialPageData();
  }, [fetchInitialPageData]);

  const handleSubmitCode = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!activationCode.trim()) {
      toast({ title: "Error", description: "Please enter an activation code.", variant: "destructive"});
      setIsLoading(false);
      return;
    }
    if (!currentUserProfileId || !currentUserRole || !currentSchoolId || !currentUserId) {
      toast({ title: "Error", description: "User profile or school context is missing. Cannot activate course.", variant: "destructive"});
      setIsLoading(false);
      return;
    }

    const finalActivationCode = activationCode.trim().toUpperCase();

    const result = await activateCourseWithCodeAction({
      activationCode: finalActivationCode,
      userProfileId: currentUserProfileId,
      userId: currentUserId,
      userRole: currentUserRole,
      schoolId: currentSchoolId,
    });

    if (result.ok && result.activatedCourse) {
      setMessage({type: 'success', text: result.message});
      toast({ title: "Course Activated!", description: result.message });
      setActivationCode('');
      setTimeout(() => {
          router.push(`/lms/courses/${result.activatedCourse!.id}`);
      }, 2000);
    } else {
      setMessage({type: 'error', text: result.message});
      toast({ title: "Activation Failed", description: result.message, variant: "destructive"});
    }
    setIsLoading(false);
  };
  
  const handlePayment = async () => {
    if (!targetCourse?.id || !currentUserId) {
        toast({ title: "Error", description: "Course or User ID is missing.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    const orderResult = await createCoursePaymentOrderAction(targetCourse.id, currentUserId);
    
    if(!orderResult.ok) {
        toast({ title: "Payment Error", description: orderResult.message || "Could not create payment order.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    if (orderResult.isMock) {
        const successMessage = orderResult.message || "Mock payment successful!";
        toast({ title: "Action Successful!", description: successMessage });
        setMessage({type: 'success', text: successMessage});
        setTimeout(() => {
            const destination = currentUserRole === 'admin' ? '/admin/lms/courses' : `/lms/courses/${targetCourse.id}`;
            router.push(destination);
        }, 2000);
        setIsLoading(false);
        return;
    }

    if (orderResult.order) {
        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: orderResult.order.amount,
            currency: "INR",
            name: targetCourse.title,
            description: `Course Enrollment: ${targetCourse.description || ''}`.substring(0, 255),
            order_id: orderResult.order.id,
            handler: async (response: any) => {
                const verifyResult = await verifyCoursePaymentAndEnrollAction(
                    response.razorpay_payment_id,
                    response.razorpay_order_id,
                    response.razorpay_signature
                );
                if (verifyResult.ok) {
                    toast({ title: 'Payment Successful', description: verifyResult.message });
                    setMessage({type: 'success', text: verifyResult.message});
                    setTimeout(() => {
                        const destination = currentUserRole === 'admin' ? '/admin/lms/courses' : `/lms/courses/${verifyResult.courseId}`;
                        router.push(destination);
                    }, 2000);
                } else {
                    toast({ title: 'Payment Failed', description: verifyResult.message, variant: 'destructive' });
                    setMessage({type: 'error', text: verifyResult.message});
                }
            },
            prefill: {
                name: currentUserName || "User",
                email: currentUserEmail || undefined,
            },
            notes: {
                course_id: targetCourse.id,
                user_id: currentUserId,
            },
            theme: {
                color: "#3399cc"
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any){
            console.error("Razorpay payment failed:", response.error);
            toast({
                title: 'Payment Failed',
                description: `Code: ${response.error.code}. Reason: ${response.error.reason}`,
                variant: 'destructive',
            });
            setMessage({type: 'error', text: `Payment failed: ${response.error.reason}`});
        });
        rzp.open();
    }
    setIsLoading(false);
  };
  
  const finalPrice = useMemo(() => {
    if (!targetCourse?.price) return 0;
    const discount = targetCourse.discount_percentage || 0;
    return targetCourse.price * (1 - discount / 100);
  }, [targetCourse]);


  if (isPageLoading) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Activate LMS Course" />
            <Card className="max-w-lg mx-auto w-full">
                <CardContent className="pt-6 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading page data...
                </CardContent>
            </Card>
        </div>
    );
  }

  const isStudent = currentUserRole === 'student';
  const isAdmin = currentUserRole === 'admin';


  return (
    <>
      <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="flex flex-col gap-6">
        <PageHeader 
          title="Activate LMS Course" 
          description={isAdmin ? "Confirm subscription details for your school." : "Enter your activation code or pay to get access to a paid course."} 
        />
        <Card className="max-w-lg mx-auto w-full">
          <CardHeader>
            <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5" /> Course Activation</CardTitle>
            {targetCourse && <CardDescription>You are activating: <strong>{targetCourse.title}</strong></CardDescription>}
          </CardHeader>
          
          {isStudent && (
             <form onSubmit={handleSubmitCode}>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="activationCode">Activation Code</Label>
                  <Input 
                    id="activationCode" 
                    value={activationCode} 
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())} 
                    placeholder="Enter code from vendor..." 
                    disabled={isLoading || isPageLoading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                 <Button type="submit" className="w-full" disabled={isLoading || isPageLoading || !activationCode.trim()}>
                  {isLoading && activationCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  {isLoading && activationCode ? 'Activating...' : 'Activate with Code'}
                </Button>
              </CardFooter>
            </form>
          )}

          {targetCourse?.is_paid && (
             <CardContent className="space-y-4">
                 {isStudent && (
                      <div className="relative flex py-2 items-center w-full">
                          <div className="flex-grow border-t border-muted"></div>
                          <span className="flex-shrink mx-4 text-muted-foreground text-xs">OR</span>
                          <div className="flex-grow border-t border-muted"></div>
                      </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-semibold capitalize">{targetCourse?.subscription_plan?.replace('_', ' ')}</span>
                    </div>
                    {targetCourse?.price && (
                      <div className="flex justify-between items-baseline">
                          <span className="text-muted-foreground">List Price</span>
                          <span className="font-semibold">₹{targetCourse.price.toFixed(2)}</span>
                      </div>
                    )}
                    {targetCourse?.discount_percentage && targetCourse.discount_percentage > 0 && (
                        <div className="flex justify-between items-baseline text-destructive">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="font-semibold">{targetCourse.discount_percentage}%</span>
                        </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-baseline text-lg">
                        <span className="font-semibold">Final Price</span>
                        <span className="font-bold">
                            ₹{finalPrice.toFixed(2)}
                        </span>
                    </div>
                  </div>
             </CardContent>
          )}
          
          {targetCourse?.is_paid && (
            <CardFooter>
                <Button type="button" onClick={handlePayment} className="w-full" disabled={isLoading || isPageLoading || !targetCourse}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Pay <span className="font-mono mx-1">₹</span>{finalPrice.toFixed(2)} and {isAdmin ? 'Subscribe School' : 'Enroll'}
                </Button>
            </CardFooter>
          )}

          <CardContent>
              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'}`}>
                  {message.type === 'success' ? <CheckCircle className="inline mr-1 h-4 w-4"/> : <XCircle className="inline mr-1 h-4 w-4"/>}
                  {message.text}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function ActivateLmsCoursePage() {
  return (
    <Suspense>
      <ActivateLmsForm/>
    </Suspense>
  );
}

