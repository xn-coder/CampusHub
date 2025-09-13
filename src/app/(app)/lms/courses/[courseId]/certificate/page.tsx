

"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Award } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import QRCode from 'qrcode';
import Image from 'next/image';

function CertificateContent() {
    const searchParams = useSearchParams();
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    const studentName = searchParams.get('studentName') || 'Valued Student';
    const completionItemName = searchParams.get('courseName') || 'the training'; // Can be course or lesson name
    const schoolName = searchParams.get('schoolName') || 'CampusHub University';
    const completionDateStr = searchParams.get('completionDate');
    const certificateId = searchParams.get('certificateId') || 'N/A';

    let completionDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    if (completionDateStr) {
        const parsedDate = parseISO(completionDateStr);
        if (isValid(parsedDate)) {
            completionDate = format(parsedDate, 'MMMM d, yyyy');
        }
    }

    useEffect(() => {
        const qrData = `Certificate ID: ${certificateId}\nStudent: ${studentName}\nCompleted: ${completionItemName}\nDate: ${completionDate}`;
        QRCode.toDataURL(qrData, { errorCorrectionLevel: 'M' })
            .then(url => {
                setQrCodeUrl(url);
            })
            .catch(err => {
                console.error("QR Code Generation Error:", err);
            });
    }, [certificateId, studentName, completionItemName, completionDate]);


    return (
        <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-serif p-4 sm:p-8 lg:p-12 print:p-8 flex flex-col items-center justify-center min-h-screen relative">
            
            <div className="w-full max-w-4xl border-4 border-yellow-700 p-4 sm:p-8 relative bg-white dark:bg-gray-800 shadow-2xl" style={{'--tw-border-opacity': '1', 'borderColor': 'rgba(182, 118, 29, var(--tw-border-opacity))'} as React.CSSProperties}>
                <div className="w-full h-full border-2 border-yellow-700 p-4 sm:p-8 text-center flex flex-col items-center justify-center">
                    
                    <Award className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-600" />

                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-yellow-800 dark:text-yellow-500 tracking-wider mt-4">
                        CERTIFICATE OF COMPLETION
                    </h1>

                    <p className="mt-6 sm:mt-8 text-lg sm:text-xl">
                        This certificate is proudly presented to
                    </p>

                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-blue-900 dark:text-blue-300 mt-4 sm:mt-6 px-4 py-2 border-b-2 border-t-2 border-yellow-700">
                        {studentName}
                    </h2>

                    <p className="mt-6 sm:mt-8 text-lg sm:text-xl">
                        for successfully completing the lesson
                    </p>

                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-blue-800 dark:text-blue-400 mt-2 sm:mt-4 italic">
                        &ldquo;{completionItemName}&rdquo;
                    </h3>

                    <p className="mt-6 sm:mt-8 text-base sm:text-lg">
                        Awarded by <strong>{schoolName}</strong> on this day,
                    </p>

                    <p className="text-xl sm:text-2xl font-medium text-gray-700 dark:text-gray-300 mt-2">
                        {completionDate}
                    </p>

                    <div className="flex w-full items-end justify-between mt-8 pt-4 border-t border-gray-300">
                        <div className="text-left text-xs text-gray-500">
                            <p>Certificate ID: {certificateId}</p>
                            <p>Powered by CampusHub</p>
                        </div>
                        {qrCodeUrl && (
                           <Image src={qrCodeUrl} alt="QR Code" width={80} height={80} />
                        )}
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

export default function CertificatePage() {
    return (
        <Suspense fallback={<div>Loading certificate...</div>}>
            <CertificateContent />
        </Suspense>
    );
}
