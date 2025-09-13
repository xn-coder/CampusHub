
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { getVoucherDataAction, type ReceiptDB, type ReceiptItemDB } from '../../actions';
import type { SchoolDetails } from '@/types';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

interface VoucherData {
    receipt: ReceiptDB;
    items: ReceiptItemDB[];
    school: SchoolDetails;
}

// Helper function to convert number to words
function numberToWords(num: number): string {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (isNaN(num)) return '';
    if ((num = Number(num)).toString().length > 9) return 'overflow';

    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] !== '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] !== '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] !== '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] !== '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] !== '00') ? ((str !== '') ? '' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    
    // Capitalize first letter
    return (str.charAt(0).toUpperCase() + str.slice(1)).trim();
}

function VoucherContent() {
    const params = useParams();
    const receiptId = params.receiptId as string;
    const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (receiptId) {
            getVoucherDataAction(receiptId)
                .then(result => {
                    if (result.ok && result.receipt && result.items && result.school) {
                        setVoucherData({
                            receipt: result.receipt,
                            items: result.items,
                            school: result.school,
                        });
                    } else {
                        setError(result.message || "Failed to load voucher data.");
                    }
                })
                .finally(() => setIsLoading(false));
        }
    }, [receiptId]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10">{error}</div>;
    }

    if (!voucherData) {
        return <div className="text-center text-muted-foreground py-10">Voucher data could not be loaded.</div>;
    }

    const { receipt, items, school } = voucherData;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4 sm:p-8 print:bg-white">
            <div className="w-full max-w-4xl bg-white dark:bg-white shadow-lg p-8 printable-area text-black">
                <header className="flex justify-between items-start pb-4 border-b-2 border-black">
                    <div className="flex items-center gap-4">
                        <Image 
                            src={school.logo_url || "/logo.png"} 
                            alt={`${school.name} Logo`} 
                            width={80} 
                            height={80}
                            className="rounded-full"
                        />
                        <div>
                            <p className="font-bold text-2xl">{school.name}</p>
                            <p className="text-xs">{school.address}</p>
                            <p className="text-xs">{school.contact_phone}, {school.contact_email}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 no-print">
                        <Button variant="outline" size="sm" asChild>
                           <Link href="/admin/receipts">
                             <ArrowLeft className="h-4 w-4 mr-1" /> Back
                           </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => window.print()}>
                            <Printer className="h-5 w-5 text-gray-600" />
                        </Button>
                    </div>
                </header>
                <div className="text-center my-4">
                    <span className="text-lg font-semibold border border-black px-4 py-1 rounded">
                        Receipt Voucher (Student Copy)
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                    <div className="flex"><span className="font-semibold w-32">Debit Account</span><span>: {receipt.payment_mode}</span></div>
                    <div className="flex justify-end"><span className="font-semibold w-24">Receipt No.</span><span>: {String(receipt.receipt_no).padStart(4, '0')}</span></div>
                    <div className="flex"><span className="font-semibold w-32">Payment Date</span><span>: {format(parseISO(receipt.payment_date), 'dd MMM, yyyy')}</span></div>
                    <div className="col-span-2 flex"><span className="font-semibold w-32 shrink-0">Narration</span><span className="break-words">: {receipt.narration || 'N/A'}</span></div>
                </div>

                <div className="border-2 border-black">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="p-2 text-left font-semibold border-b-2 border-r border-black">Ledgers</th>
                                <th className="p-2 text-left font-semibold border-b-2 border-r border-black">Description</th>
                                <th className="p-2 text-right font-semibold border-b-2 border-black">Amount (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td className="p-2 border-r border-black align-top">{item.ledger}</td>
                                    <td className="p-2 border-r border-black align-top">{item.description}</td>
                                    <td className="p-2 text-right align-top font-mono">{item.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                            {/* Fill empty rows */}
                            {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                                <tr key={`empty-${i}`}><td className="p-2 border-r border-black h-8"></td><td className="p-2 border-r border-black"></td><td className="p-2"></td></tr>
                            ))}
                            <tr>
                                <td className="p-2 border-t-2 border-r border-black font-semibold" colSpan={2}>
                                    Amount in Words: Rupees {numberToWords(receipt.total_amount)} Only
                                </td>
                                <td className="p-2 border-t-2 border-black">
                                    <div className="flex justify-between border-b border-gray-400 py-1 font-semibold"><span>Total Amount</span><span className="font-mono">{receipt.total_amount.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-gray-400 py-1 font-semibold"><span>Payable</span><span className="font-mono">{receipt.total_amount.toFixed(2)}</span></div>
                                    <div className="flex justify-between font-bold py-1"><span>Received Amount</span><span className="font-mono">{receipt.total_amount.toFixed(2)}</span></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-16 text-xs text-center">
                    <div><span className="border-t border-black pt-1">Prepared by (Name & Designation)</span></div>
                    <div><span className="border-t border-black pt-1">Checked by (Name & Designation)</span></div>
                    <div><span className="border-t border-black pt-1">Signature of Principal (With Official Seal)</span></div>
                </div>

            </div>
             <div className="mt-8 print:hidden">
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    Download / Print Voucher
                </Button>
            </div>
        </div>
    );
}

export default function ReceiptVoucherPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VoucherContent />
        </Suspense>
    );
}
