
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StudentScore, Student, Exam, ClassData, Subject, Teacher } from '@/types';
import { useState, useEffect, useMemo } from 'react';
import { Award, Filter, Search, User, BookOpen, CalendarCheck, UserCogIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const MOCK_STUDENT_SCORES_KEY = 'mockStudentScoresData';
const MOCK_STUDENTS_KEY = 'mockStudentsData';
const MOCK_EXAMS_KEY = 'mockExamsData';
const MOCK_CLASSES_KEY = 'mockClassesData';
const MOCK_SUBJECTS_KEY = 'mockSubjectsData';
const MOCK_TEACHERS_KEY = 'mockTeachersData';


export default function AdminStudentScoresPage() {
  const [allScores, setAllScores] = useState<StudentScore[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState(''); // For student name
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');


  useEffect(() => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      const storedScores = localStorage.getItem(MOCK_STUDENT_SCORES_KEY);
      setAllScores(storedScores ? JSON.parse(storedScores) : []);

      const storedStudents = localStorage.getItem(MOCK_STUDENTS_KEY);
      setAllStudents(storedStudents ? JSON.parse(storedStudents) : []);
      
      const storedExams = localStorage.getItem(MOCK_EXAMS_KEY);
      setAllExams(storedExams ? JSON.parse(storedExams) : []);
      
      const storedClasses = localStorage.getItem(MOCK_CLASSES_KEY);
      setAllClasses(storedClasses ? JSON.parse(storedClasses) : []);

      const storedSubjects = localStorage.getItem(MOCK_SUBJECTS_KEY);
      setAllSubjects(storedSubjects ? JSON.parse(storedSubjects) : []);
      
      const storedTeachers = localStorage.getItem(MOCK_TEACHERS_KEY);
      setAllTeachers(storedTeachers ? JSON.parse(storedTeachers) : []);
      
      setIsLoading(false);
    }
  }, []);

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
      const studentName = getStudentName(score.studentId).toLowerCase();
      const examDetails = allExams.find(e => e.id === score.examId);

      const matchesSearchTerm = !searchTerm || studentName.includes(searchTerm.toLowerCase());
      const matchesClass = selectedClassFilter === 'all' || score.classSectionId === selectedClassFilter;
      const matchesExam = selectedExamFilter === 'all' || score.examId === selectedExamFilter;
      const matchesSubject = selectedSubjectFilter === 'all' || (examDetails && examDetails.subjectId === selectedSubjectFilter);
      
      return matchesSearchTerm && matchesClass && matchesExam && matchesSubject;
    }).sort((a,b) => parseISO(b.dateRecorded).getTime() - parseISO(a.dateRecorded).getTime()); // Sort by most recent recorded
  }, [allScores, searchTerm, selectedClassFilter, selectedExamFilter, selectedSubjectFilter, allStudents, allExams]);


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
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block mb-1"><Search className="inline-block mr-1 h-4 w-4" />Search Student</Label>
              <Input 
                id="searchTerm"
                placeholder="Student name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="classFilter" className="block mb-1"><Filter className="inline-block mr-1 h-4 w-4" />Filter by Class</Label>
              <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                <SelectTrigger id="classFilter"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {allClasses.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.name} - {cls.division}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="subjectFilter" className="block mb-1"><BookOpen className="inline-block mr-1 h-4 w-4" />Filter by Subject</Label>
              <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                <SelectTrigger id="subjectFilter"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {allSubjects.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name} ({sub.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="examFilter" className="block mb-1"><FileText className="inline-block mr-1 h-4 w-4" />Filter by Exam</Label>
              <Select value={selectedExamFilter} onValueChange={setSelectedExamFilter}>
                <SelectTrigger id="examFilter"><SelectValue placeholder="All Exams" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {allExams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name} ({getSubjectName(exam.subjectId)})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading scores...</p>
          ) : filteredScores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scores found matching your criteria. Teachers can enter scores via their Gradebook.</p>
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
                    <TableCell className="font-medium">{getStudentName(score.studentId)}</TableCell>
                    <TableCell>{getClassName(score.classSectionId)}</TableCell>
                    <TableCell>{getExamName(score.examId)}</TableCell>
                    <TableCell>{getSubjectName(score.subjectId)}</TableCell>
                    <TableCell className="font-semibold">{String(score.score)}</TableCell>
                    <TableCell>{score.maxMarks ?? 'N/A'}</TableCell>
                    <TableCell>{getTeacherName(score.recordedByTeacherId)}</TableCell>
                    <TableCell>{format(parseISO(score.dateRecorded), 'PP')}</TableCell>
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
