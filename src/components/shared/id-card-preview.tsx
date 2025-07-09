import type { Student } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns';

interface IdCardPreviewProps {
  student: Student;
  schoolName: string | null;
  className: string | null;
}

function formatDateSafe(dateString?: string | null): string {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MM/dd/yyyy') : 'N/A';
}

export function IdCardPreview({ student, schoolName, className }: IdCardPreviewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-xs aspect-[54/86] p-3 flex flex-col text-gray-800 dark:text-gray-200 print:shadow-none print:border print:border-gray-300">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/80">
        <Image src="/logo.png" alt="School Logo" width={30} height={30} className="rounded-full" />
        <h2 className="text-xs font-bold text-center flex-grow uppercase truncate text-primary/90">{schoolName || 'CampusHub School'}</h2>
      </div>

      {/* Body */}
      <div className="flex-grow flex flex-col items-center justify-center text-center py-3">
        <Avatar className="w-20 h-20 mb-2 border-2 border-primary/50">
          <AvatarImage src={student.profile_picture_url || undefined} alt={student.name} data-ai-hint="person student" />
          <AvatarFallback className="text-2xl">{student.name ? student.name.substring(0, 2).toUpperCase() : 'S'}</AvatarFallback>
        </Avatar>
        <h3 className="text-lg font-bold leading-tight">{student.name}</h3>
        <p className="text-xs text-muted-foreground">{className || 'N/A'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Roll No: {student.roll_number || 'N/A'}</p>
      </div>

      {/* Footer */}
      <div className="text-[10px] space-y-1 border-t border-gray-200 dark:border-gray-700 pt-2 font-sans">
        <div className="flex justify-between">
          <span className="font-semibold">Contact:</span>
          <span className="font-mono">{student.contact_number || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Blood Group:</span>
          <span className="font-bold text-red-600 font-mono">{student.blood_group || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">DOB:</span>
          <span className="font-mono">{formatDateSafe(student.date_of_birth)}</span>
        </div>
      </div>
      
       <div className="text-[8px] text-center text-gray-400 mt-2 print:hidden">
          Powered by CampusHub
        </div>
    </div>
  );
}
