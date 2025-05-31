import type React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-foreground">{title}</h1>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
