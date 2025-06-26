
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StudentScore, Student, Exam, ClassData, Subject, Teacher } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Award, Filter, Search, User, BookOpen, CalendarCheck, UserCogIcon, FileText, Loader2, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { getStudentScoresPageDataAction } from './actions';
import { Button } from '@/components/ui/button';

export default function AdminStudentScoresPage() {
  const { toast } = useToast();
  const [allScores, setAllScores] = useState<StudentScore[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allTeachers, setAllTeachers] = useState<Pick<Teacher, 'id' | 'name'>[]>([]); // Store only id and name
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState(''); // For student name
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  useEffect(() => {
    const adminUserId = localStorage.getItem('currentUserId');
    if (adminUserId) {
      loadInitialData(adminUserId);
    } else {
      toast({ title: "Error", description: "Admin user not identified.", variant: "destructive" });
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitialData(adminUserId: string) {
    setIsLoading(true);
    const result = await getStudentScoresPageDataAction(adminUserId);
    if (result.ok) {
      setCurrentSchoolId(result.schoolId || null);
      setAllScores(result.scores || []);
      setAllStudents(result.students || []);
      setAllExams(result.exams || []);
      setAllClasses(result.classes || []);
      setAllSubjects(result.subjects || []);
      setAllTeachers(result.teachers || []);
    } else {
      toast({ title: "Error loading data", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  }

  const getStudentName = (studentId: string) => allStudents.find(s => s.id === studentId)?.name || 'N/A';
  const getExamName = (examId: string) => allExams.find(e => e.id === examId)?.name || 'N/A';
  const getClassName = (classId: string) => {
    const cls = allClasses.find(c => c.id === classId);
    return cls ? `${cls.name} - ${cls.division}` : 'N/A';
  };
  const getSubjectName = (subjectId: string) => allSubjects.find(s => s.id === subjectId)?.name || 'N/A';
  const getTeacherName = (teacherId: string) => allTeachers.find(t => t.id === teacherId)?.name || 'N/A';

  const filteredScores = useMemo(() => {
    return allScores.filter(score => {
      const studentName = getStudentName(score.student_id).toLowerCase();
      
      const matchesSearchTerm = !searchTerm || studentName.includes(searchTerm.toLowerCase());
      const matchesClass = selectedClassFilter === 'all' || score.class_id === selectedClassFilter;
      const matchesExam = selectedExamFilter === 'all' || score.exam_id === selectedExamFilter;
      const matchesSubject = selectedSubjectFilter === 'all' || score.subject_id === selectedSubjectFilter;
      
      return matchesSearchTerm && matchesClass && matchesExam && matchesSubject;
    });
  }, [allScores, searchTerm, selectedClassFilter, selectedExamFilter, selectedSubjectFilter, allStudents, allExams, allClasses, allSubjects]);
  
  const handleDownloadCsv = () => {
    if (filteredScores.length === 0) {
        toast({ title: "No Data", description: "There is no data to download for the current filters.", variant: "destructive"});
        return;
    }
    const headers = ["Student", "Class", "Exam", "Subject", "Score", "Max Marks", "Recorded By", "Date Recorded"];
    const csvRows = [
        headers.join(','),
        ...filteredScores.map(score => {
            const row = [
                `"${getStudentName(score.student_id).replace(/"/g, '""')}"`,
                `"${getClassName(score.class_id).replace(/"/g, '""')}"`,
                `"${getExamName(score.exam_id).replace(/"/g, '""')}"`,
                `"${getSubjectName(score.subject_id).replace(/"/g, '""')}"`,
                `"${String(score.score)}"`
                ,
                score.max_marks ?? 'N/A',
                `"${getTeacherName(score.recorded_by_teacher_id).replace(/"/g, '""')}"`,
                `"${format(parseISO(score.date_recorded), 'yyyy-MM-dd')}"`
            ];
            return row.join(',');
        })
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_scores_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Student Scores Overview" 
        description="Review and analyze student academic scores entered by teachers." 
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5" />Student Performance Records</CardTitle>
          <CardDescription>View student scores across various exams and classes. Use filters to narrow down results.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="searchTerm" className="block mb-1"><Search className="inline-block mr-1 h-4 w-4" />Search Student</Label>
              <Input 
                id="searchTerm"
                placeholder="Student name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !currentSchoolId}
              />
            </div>
            <div>
              <Label htmlFor="classFilter" className="block mb-1"><Filter className="inline-block mr-1 h-4 w-4" />Filter by Class</Label>
              <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter} disabled={isLoading || !currentSchoolId}>
                <SelectTrigger id="classFilter"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {allClasses.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="subjectFilter" className="block mb-1"><BookOpen className="inline-block mr-1 h-4 w-4" />Filter by Subject</Label>
              <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter} disabled={isLoading || !currentSchoolId}>
                <SelectTrigger id="subjectFilter"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {allSubjects.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name} ({sub.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examFilter" className="block mb-1"><FileText className="inline-block mr-1 h-4 w-4" />Filter by Exam</Label>
              <Select value={selectedExamFilter} onValueChange={setSelectedExamFilter} disabled={isLoading || !currentSchoolId}>
                <SelectTrigger id="examFilter"><SelectValue placeholder="All Exams" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {allExams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name} ({getSubjectName(exam.subject_id)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div className="lg:col-start-4">
                 <Button onClick={handleDownloadCsv} disabled={isLoading || filteredScores.length === 0} className="w-full">
                    <FileDown className="mr-2 h-4 w-4" /> Download Report
                </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : !currentSchoolId ? (
             <p className="text-destructive text-center py-4">Admin not associated with a school. Cannot view scores.</p>
          ) : filteredScores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scores found matching your criteria for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><User className="inline-block mr-1 h-4 w-4"/>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead><FileText className="inline-block mr-1 h-4 w-4"/>Exam</TableHead>
                  <TableHead><BookOpen className="inline-block mr-1 h-4 w-4"/>Subject</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Max Marks</TableHead>
                  <TableHead><UserCogIcon className="inline-block mr-1 h-4 w-4"/>Recorded By</TableHead>
                  <TableHead><CalendarCheck className="inline-block mr-1 h-4 w-4"/>Date Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScores.map((score) => (
                  <TableRow key={score.id}>
                    <TableCell className="font-medium">{getStudentName(score.student_id)}</TableCell>
                    <TableCell>{getClassName(score.class_id)}</TableCell>
                    <TableCell>{getExamName(score.exam_id)}</TableCell>
                    <TableCell>{getSubjectName(score.subject_id)}</TableCell>
                    <TableCell className="font-semibold">{String(score.score)}</TableCell>
                    <TableCell>{score.max_marks ?? 'N/A'}</TableCell>
                    <TableCell>{getTeacherName(score.recorded_by_teacher_id)}</TableCell>
                    <TableCell>{format(parseISO(score.date_recorded), 'PP')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
