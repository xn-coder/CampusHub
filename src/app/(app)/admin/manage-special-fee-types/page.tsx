
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedSpecialFeesPage() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to the unified page
    router.replace('/admin/manage-fee-types');
  }, [router]);

  return (
    <div>
      <p>This page has been moved. Redirecting to the unified Fee Types management page...</p>
    </div>
  );
}
