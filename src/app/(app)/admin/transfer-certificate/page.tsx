
"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Award, Loader2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import type { Student, SchoolDetails, ClassData } from '@/types';
import Image from 'next/image';

interface CertificateData {
    student: Student | null;
    school: SchoolDetails | null;
    classInfo: ClassData | null;
}

function CertificateContent() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('studentId');
    const [data, setData] = useState<CertificateData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            if (!studentId) {
                setIsLoading(false);
                return;
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (studentError || !student) {
                console.error("Error fetching student for TC:", studentError);
                setIsLoading(false);
                return;
            }

            const schoolId = student.school_id;
            const classId = student.class_id;

            const { data: school, error: schoolError } = await supabase
                .from('schools')
                .select('*')
                .eq('id', schoolId)
                .single();
            
            const { data: classInfo, error: classError } = await supabase
                .from('classes')
                .select('*')
                .eq('id', classId)
                .single();

            setData({ 
                student: student as Student, 
                school: school as SchoolDetails,
                classInfo: classInfo as ClassData
            });
            setIsLoading(false);
        }
        fetchData();
    }, [studentId]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!data?.student || !data?.school) {
        return <div className="text-center py-10 text-destructive">Could not load required data to generate the certificate.</div>;
    }

    const { student, school, classInfo } = data;
    const issueDate = format(new Date(), 'MMMM d, yyyy');
    const studentName = student.name;
    const fatherName = student.father_name || 'N/A';
    const dob = student.date_of_birth ? format(parseISO(student.date_of_birth), 'MMMM d, yyyy') : 'N/A';
    const admissionDate = student.admission_date ? format(parseISO(student.admission_date), 'MMMM d, yyyy') : 'N/A';
    const lastClass = classInfo ? `${classInfo.name} - ${classInfo.division}` : 'N/A';

    return (
        <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-serif p-4 sm:p-8 lg:p-12 print:p-8 flex flex-col items-center justify-center min-h-screen relative">
            <div className="w-full max-w-4xl border-4 border-blue-900 p-2 relative bg-white dark:bg-gray-800 shadow-2xl">
                <div className="w-full h-full border-2 border-blue-900 p-6 text-center flex flex-col items-center justify-center">
                    <Image src="/logo.png" alt="School Logo" width={80} height={80} className="mb-4" />
                    <h1 className="text-3xl sm:text-4xl font-bold text-blue-900 dark:text-blue-400 tracking-wider">
                        {school.name}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{school.address}</p>
                    
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-300 tracking-wider mt-8 py-2 border-y-2 border-blue-800">
                        TRANSFER CERTIFICATE
                    </h2>
                    
                    <div className="text-left w-full mt-8 text-base space-y-3">
                        <p>This is to certify that <strong className="font-bold">{studentName}</strong>, son/daughter of <strong className="font-bold">{fatherName}</strong>, was a student of this school.</p>
                        <p>According to the school records, their date of birth is <strong className="font-bold">{dob}</strong>.</p>
                        <p>They were admitted to the school on <strong className="font-bold">{admissionDate}</strong> and were studying in class <strong className="font-bold">{lastClass}</strong> at the time of leaving.</p>
                        <p>Their conduct during their stay at the school was <strong className="font-bold">Good</strong>.</p>
                        <p>All dues to the school have been cleared.</p>
                        <p>We wish them all the best for their future.</p>
                    </div>

                    <div className="flex justify-between w-full mt-24">
                        <div>
                            <p className="border-t-2 border-dashed border-gray-500 pt-1">Date: {issueDate}</p>
                        </div>
                        <div>
                           <p className="border-t-2 border-dashed border-gray-500 pt-1">Principal's Signature</p>
                        </div>
                    </div>
                </div>
            </div>
             <div className="mt-8 print:hidden">
                <Button onClick={() => window.print()}>
                    <Download className="mr-2 h-4 w-4" />
                    Download / Print Certificate
                </Button>
            </div>
        </div>
    );
}

export default function TransferCertificatePage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CertificateContent />
        </Suspense>
    );
}
