
"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import type { Student, SchoolDetails, ClassData } from '@/types';
import Image from 'next/image';

interface CertificateData {
    student: Student | null;
    school: SchoolDetails | null;
    classInfo: ClassData | null;
}

// Helper function to convert number to words
function numberToWords(num: number): string {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += n[1] != '00' ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += n[2] != '00' ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += n[3] != '00' ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += n[4] != '0' ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += n[5] != '00' ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Helper to format date to words
function dateToWords(dateString: string): string {
    if (!isValid(parseISO(dateString))) return 'N/A';
    const date = parseISO(dateString);
    const day = numberToWords(date.getDate());
    const month = format(date, 'MMMM').toUpperCase();
    const year = numberToWords(date.getFullYear());
    return `${day} ${month} ${year}`;
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

    const renderDottedField = (label: string, value?: string | null, isBold = false) => (
      <div className="flex">
        <span className="shrink-0">{label}&nbsp;</span>
        <div className="relative flex-grow">
          <span className={`absolute bottom-0 w-full text-center ${isBold ? 'font-bold' : ''}`}>
            {value || ''}
          </span>
          <span className="w-full border-b border-dotted border-gray-500">&nbsp;</span>
        </div>
      </div>
    );

    return (
        <div className="bg-gray-100 dark:bg-gray-900 font-serif p-4 sm:p-8 flex flex-col items-center min-h-screen relative">
            <div className="w-full max-w-4xl bg-white p-6 printable-area text-black">
                <header className="flex flex-col items-center justify-center text-center pb-2">
                    <Image src={school.logo_url || "/logo.png"} alt="School Logo" width={80} height={80} className="mb-2 rounded-full" />
                    <h1 className="text-2xl font-bold">{school.name}</h1>
                    <p className="text-sm">{school.address}</p>
                    <p className="text-sm">{school.contact_phone}, {school.contact_email}</p>
                </header>
                
                <div className="text-center my-2">
                    <span className="text-lg font-bold border-2 border-black px-4 py-1">
                        TRANSFER CERTIFICATE
                    </span>
                </div>
                
                <div className="grid grid-cols-4 gap-x-4 text-xs mb-2">
                    <span>School No.: ..............</span>
                    <span>Book No.: ..............</span>
                    <span>S.No.: ..............</span>
                    <span>Admission No.: {student.id.substring(0,6)}...</span>
                </div>
                 <div className="grid grid-cols-3 gap-x-4 text-xs mb-4">
                    <span>Affiliation No.: ..............</span>
                    <span>Renewed upto: ..............</span>
                    <span>Status of school: Sr. Secondary</span>
                 </div>
                 <div className="text-xs mb-4">Registration No. of the Candidate (in case Class-IX to XII): .............................................</div>
                
                <div className="text-sm space-y-1.5">
                    {renderDottedField("1. Name of the Pupil:", student.name, true)}
                    {renderDottedField("2. Mother's Name:", student.mother_name, true)}
                    {renderDottedField("3. Father's Name:", student.father_name, true)}
                    {renderDottedField("4. Date of birth according to the Admission Register (in figure):", student.date_of_birth ? format(parseISO(student.date_of_birth), 'dd/MM/yyyy') : 'N/A', true)}
                    {renderDottedField("   (in words)", student.date_of_birth ? dateToWords(student.date_of_birth) : 'N/A', true)}
                    {renderDottedField("5. Nationality:", student.nationality, true)}
                    {renderDottedField("6. whether the candidate belongs to SC/ST/OBC Category:", student.category, true)}
                    {renderDottedField("7. Date of first admission in the school with class:", student.admission_date ? format(parseISO(student.admission_date), 'dd-MM-yyyy') : 'N/A', true)}
                    {renderDottedField("8. class in which the pupil last studied (in figures):", classInfo?.name, true)}
                    {renderDottedField("   (in words)", classInfo?.name, true)}
                    {renderDottedField("9. School/Board Annual Examination last taken with result:", "CBSE", true)}
                    {renderDottedField("10. Whether the student is failed:", "NO", true)}
                    {renderDottedField("11. Subject offered:", "1. ENG 2. BIO 3. PHYS 4. CHEM 5. PHY EDU 6. GEN STU", true)}
                    {renderDottedField("12. Whether qualified for promotion to the next higher class:", "YES", true)}
                    {renderDottedField("13. Whether the pupil has paid all dues to the Vidyalaya:", "YES", true)}
                    {renderDottedField("14. Whether the pupil was in receipt of any fee concession, if so the nature of such concession:", "NO", true)}
                    {renderDottedField("15. No. of meetings up to date:", "N/A", true)}
                    {renderDottedField("16. Total No. of working days pupil present in the school:", "N/A", true)}
                    {renderDottedField("17. Whether the Pupil in NCC Cadet/ Boys Scout/ Girl Guide (give details):", "NO", true)}
                    {renderDottedField("18. Games played or extracurricular activities in which the pupil usually took part (mention achievement level there in):", "NO", true)}
                    {renderDottedField("19. General Conduct:", "GOOD", true)}
                    {renderDottedField("20. Date on which pupils' name was struck off the rolls of the Vidyalaya:", format(new Date(), 'dd-MM-yyyy'), true)}
                    {renderDottedField("21. Date of issue of Certificate:", format(new Date(), 'dd-MM-yyyy'), true)}
                    {renderDottedField("22. Reason for leaving the school:", "PASSED", true)}
                    {renderDottedField("23. Any other remarks:", "NO", true)}
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 text-xs my-4">
                   <span>PEN No.: ............................</span>
                   <span>UDISE CODE: ............................</span>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-16 text-xs text-center">
                    <div><span className="border-t border-black pt-1">Prepared by (Name & Designation)</span></div>
                    <div><span className="border-t border-black pt-1">Checked by (Name & Designation)</span></div>
                    <div><span className="border-t border-black pt-1">Signature of Principal (With Official Seal)</span></div>
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
