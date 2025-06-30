
import PageHeader from '@/components/shared/page-header';
import LeaveForm from '@/components/leave-application/leave-form';

export default function LeaveApplicationPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Leave Application" 
        description="Submit and manage student leave requests. Your application will be pending review by an administrator." 
      />
      <div className="max-w-2xl mx-auto w-full">
        <LeaveForm />
      </div>
    </div>
  );
}
