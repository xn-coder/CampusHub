import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - CampusHub',
  description: 'Login to CampusHub',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
