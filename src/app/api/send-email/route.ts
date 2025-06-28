// This API route has been deprecated.
// The email sending logic has been moved to a server action in /src/services/emailService.ts
// to avoid the need for internal fetch() calls from other server actions.
// This file can be safely deleted.

import {NextResponse} from 'next/server';

export async function POST() {
    return NextResponse.json({
        success: false,
        message: 'This API endpoint is deprecated. Use the sendEmail server action instead.'
    }, {status: 410}); // 410 Gone
}
