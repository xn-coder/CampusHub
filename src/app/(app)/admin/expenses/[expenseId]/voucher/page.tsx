
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { getExpenseVoucherDataAction } from '../../actions';
import type { Expense, SchoolDetails, ExpenseCategory } from '@/types';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';

interface VoucherData {
    expense: Expense;
    school: SchoolDetails;
}

function VoucherContent() {
    const params = useParams();
    const expenseId = params.expenseId as string;
    const [voucherData, setVoucherData] = useState<VoucherData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (expenseId) {
            getExpenseVoucherDataAction(expenseId)
                .then(result => {
                    if (result.ok) {
                        setVoucherData({
                            expense: result.expense!,
                            school: result.school!,
                        });
                    } else {
                        setError(result.message || "Failed to load voucher data.");
                    }
                })
                .finally(() => setIsLoading(false));
        }
    }, [expenseId]);
    
    const generateReceiptNumber = (createdAt?: string) => {
        if (!createdAt) return 'N/A';
        try {
            const date = new Date(createdAt);
            const timestamp = date.getTime();
            return (timestamp % 100000000).toString().padStart(8, '0');
        } catch (e) {
            return 'N/A';
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10">{error}</div>;
    }

    if (!voucherData) {
        return <div className="text-center text-muted-foreground py-10">Voucher data could not be loaded.</div>;
    }

    const { expense, school } = voucherData;
    const receiptNumber = generateReceiptNumber(expense.created_at);

    return (
        <div className="bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4 sm:p-8 print:bg-white">
            <div className="w-full max-w-4xl bg-white dark:bg-card shadow-lg p-8 printable-area">
                <header className="flex justify-between items-start pb-4 border-b border-gray-300">
                    <div className="flex items-center gap-4">
                        <Image 
                            src={school.logo_url || "/logo.png"} 
                            alt={`${school.name} Logo`} 
                            width={60} 
                            height={60}
                            className="rounded-full"
                        />
                        <div>
                            <p className="font-bold text-xl text-gray-800 dark:text-gray-200">{school.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{school.address}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{school.contact_phone}, {school.contact_email}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="print:hidden" onClick={() => window.print()}>
                        <Printer className="h-5 w-5" />
                    </Button>
                </header>
                <div className="text-center my-4">
                    <span className="text-lg font-semibold border border-gray-400 px-4 py-1 rounded">
                        Payment Voucher
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                    <div className="flex">
                        <span className="font-semibold w-32">Credit Account</span>
                        <span>Cash</span>
                    </div>
                    <div className="flex justify-end">
                        <span className="font-semibold w-24">Receipt No.</span>
                        <span className="border-b border-gray-400 flex-grow text-right">{receiptNumber}</span>
                    </div>
                    <div className="flex">
                        <span className="font-semibold w-32">Payment Date</span>
                        <span>{format(parseISO(expense.date), 'dd MMM, yyyy')}</span>
                    </div>
                    <div className="col-span-2 flex">
                        <span className="font-semibold w-32">Narration</span>
                        <span>{expense.notes || 'N/A'}</span>
                    </div>
                </div>

                <div className="border border-gray-400">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-muted">
                                <th className="p-2 text-left font-semibold border-b border-r border-gray-400">Ledgers</th>
                                <th className="p-2 text-left font-semibold border-b border-r border-gray-400">Description</th>
                                <th className="p-2 text-right font-semibold border-b border-gray-400">Amount (Rs.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border-r border-gray-400 h-24 align-top">{(expense.category as any)?.name || 'N/A'}</td>
                                <td className="p-2 border-r border-gray-400 h-24 align-top">{expense.title}</td>
                                <td className="p-2 text-right h-24 align-top">{(expense.amount).toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td className="p-2 border-t border-r border-gray-400" colSpan={2}>
                                    <span className="font-semibold">Amount in Words:</span> Rupees {numberToWords(expense.amount)} Only
                                </td>
                                <td className="p-2 border-t border-gray-400">
                                    <div className="flex justify-between border-b border-gray-300 py-1"><span>Total Amount</span><span>{(expense.amount).toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-gray-300 py-1"><span>Payable</span><span>{(expense.amount).toFixed(2)}</span></div>
                                    <div className="flex justify-between font-semibold py-1"><span>Paid</span><span>{(expense.amount).toFixed(2)}</span></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-3 gap-8 mt-20 text-sm">
                    <div className="text-center"><span className="border-t border-gray-400 pt-1">Approved By</span></div>
                    <div className="text-center"><span className="border-t border-gray-400 pt-1">Checked By</span></div>
                    <div className="text-center"><span className="border-t border-gray-400 pt-1">Receiver Signature</span></div>
                </div>

                <footer className="flex justify-between items-center text-xs text-gray-500 border-t border-dashed mt-8 pt-2">
                    <span>Printed On: {format(new Date(), 'dd-MMM-yyyy hh:mm:ss a')}</span>
                    <span>Auth. Signatory</span>
                </footer>
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

// Helper function to convert number to words
function numberToWords(num: number): string {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if ((num = num.toString()).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
}


export default function ExpenseVoucherPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <VoucherContent />
        </Suspense>
    );
}
