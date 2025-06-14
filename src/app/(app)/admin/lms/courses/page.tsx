
"use client";

import PageHeader from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Edit2, Trash2, Save, Library, Users, FileTextIcon, KeyRound, Copy, Settings, UserPlus } from 'lucide-react';
import type { Course, CourseActivationCode } from '@/types';
import { useState, useEffect, type FormEvent } from 'react';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

const MOCK_LMS_COURSES_KEY = 'mockLMSCoursesData';
const MOCK_LMS_ACTIVATION_CODES_KEY = 'mockLMSActivationCodesData';

export default function ManageCoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [activationCodes, setActivationCodes] = useState<CourseActivationCode[]>([]);
  
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForCodeGeneration, setCourseForCodeGeneration] = useState<Course | null>(null);
  const [generatedCodesForDisplay, setGeneratedCodesForDisplay] = useState<string[]>([]);
  const [numCodesToGenerate, setNumCodesToGenerate] = useState<number>(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number | ''>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCourses = localStorage.getItem(MOCK_LMS_COURSES_KEY);
      setCourses(storedCourses ? JSON.parse(storedCourses) : []);
      
      const storedCodes = localStorage.getItem(MOCK_LMS_ACTIVATION_CODES_KEY);
      setActivationCodes(storedCodes ? JSON.parse(storedCodes) : []);
    }
  }, []);

  const updateLocalStorage = (key: string, data: any[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const resetCourseForm = () => {
    setTitle('');
    setDescription('');
    setIsPaid(false);
    setPrice('');
    setEditingCourse(null);
  };

  const handleOpenCourseDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setTitle(course.title);
      setDescription(course.description);
      setIsPaid(course.isPaid);
      setPrice(course.price ?? '');
    } else {
      resetCourseForm();
    }
    setIsCourseDialogOpen(true);
  };

  const handleCourseSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Error", description: "Course Title is required.", variant: "destructive" });
      return;
    }
    if (isPaid && (price === '' || Number(price) <= 0)) {
      toast({ title: "Error", description: "Price is required for paid courses and must be greater than 0.", variant: "destructive" });
      return;
    }

    let updatedCourses;
    const courseData = {
      title: title.trim(),
      description: description.trim(),
      isPaid,
      price: isPaid ? Number(price) : undefined,
      resources: editingCourse?.resources || { ebooks: [], videos: [], notes: [], webinars: [] },
      enrolledStudentIds: editingCourse?.enrolledStudentIds || [],
      enrolledTeacherIds: editingCourse?.enrolledTeacherIds || [],
    };

    if (editingCourse) {
      updatedCourses = courses.map(c =>
        c.id === editingCourse.id ? { ...c, ...courseData } : c
      );
      toast({ title: "Course Updated", description: `"${title.trim()}" has been updated.` });
    } else {
      const newCourse: Course = {
        id: `course-${uuidv4()}`,
        ...courseData,
      };
      updatedCourses = [newCourse, ...courses];
      toast({ title: "Course Added", description: `"${title.trim()}" has been added.` });
    }
    
    setCourses(updatedCourses);
    updateLocalStorage(MOCK_LMS_COURSES_KEY, updatedCourses);
    resetCourseForm();
    setIsCourseDialogOpen(false);
  };
  
  const handleDeleteCourse = (courseId: string) => {
    const courseToDelete = courses.find(c => c.id === courseId);
    if (!courseToDelete) return;
    if (confirm(`Are you sure you want to delete the course "${courseToDelete.title}"? This will also remove related activation codes.`)) {
      const updatedCourses = courses.filter(c => c.id !== courseId);
      setCourses(updatedCourses);
      updateLocalStorage(MOCK_LMS_COURSES_KEY, updatedCourses);

      const updatedCodes = activationCodes.filter(code => code.courseId !== courseId);
      setActivationCodes(updatedCodes);
      updateLocalStorage(MOCK_LMS_ACTIVATION_CODES_KEY, updatedCodes);

      toast({ title: "Course Deleted", variant: "destructive" });
    }
  };

  const handleOpenCodeGenerationDialog = (course: Course) => {
    if (!course.isPaid) {
      toast({ title: "Not a Paid Course", description: "Activation codes can only be generated for paid courses.", variant: "destructive" });
      return;
    }
    setCourseForCodeGeneration(course);
    setNumCodesToGenerate(1);
    setGeneratedCodesForDisplay([]);
    setIsCodeDialogOpen(true);
  };

  const handleGenerateCodes = () => {
    if (!courseForCodeGeneration || numCodesToGenerate <= 0) {
      toast({ title: "Error", description: "Please select a course and specify a valid number of codes.", variant: "destructive"});
      return;
    }
    const newCodes: CourseActivationCode[] = [];
    const displayableCodes: string[] = [];

    for (let i = 0; i < numCodesToGenerate; i++) {
      const uniqueCode = `COURSE-${courseForCodeGeneration.id.substring(0,4)}-${uuidv4().substring(0, 8).toUpperCase()}`;
      newCodes.push({
        id: `code-${uuidv4()}`,
        courseId: courseForCodeGeneration.id,
        code: uniqueCode,
        isUsed: false,
        generatedDate: new Date().toISOString(),
      });
      displayableCodes.push(uniqueCode);
    }
    
    const updatedActivationCodes = [...activationCodes, ...newCodes];
    setActivationCodes(updatedActivationCodes);
    updateLocalStorage(MOCK_LMS_ACTIVATION_CODES_KEY, updatedActivationCodes);
    setGeneratedCodesForDisplay(displayableCodes);
    toast({ title: `${numCodesToGenerate} Activation Code(s) Generated`, description: `For course: ${courseForCodeGeneration.title}`});
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => toast({ title: "Code Copied!", description: code }))
      .catch(() => toast({ title: "Copy Failed", variant: "destructive"}));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="LMS Course Management"
        description="Create, edit, and manage online courses and their activation codes."
        actions={
          <Button onClick={() => handleOpenCourseDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Course
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Library className="mr-2 h-5 w-5" />Available Courses</CardTitle>
          <CardDescription>List of all courses offered in the LMS.</CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No courses created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell className="max-w-xs truncate">{course.description}</TableCell>
                    <TableCell>{course.isPaid ? 'Paid' : 'Unpaid'}</TableCell>
                    <TableCell>{course.isPaid && course.price ? `$${course.price.toFixed(2)}` : 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/lms/courses/${course.id}/content`}>
                           <Settings className="mr-1 h-3 w-3" /> Content
                        </Link>
                      </Button>
                       <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/lms/courses/${course.id}/enrollments`}>
                          <UserPlus className="mr-1 h-3 w-3" /> Enroll
                        </Link>
                      </Button>
                      {course.isPaid && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenCodeGenerationDialog(course)}>
                          <KeyRound className="mr-1 h-3 w-3" /> Codes
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => handleOpenCourseDialog(course)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteCourse(course.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit' : 'Add New'} Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCourseSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Introduction to Programming" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the course" />
              </div>
              <div>
                <Label>Course Type</Label>
                <RadioGroup value={isPaid ? "paid" : "unpaid"} onValueChange={(val) => setIsPaid(val === "paid")} className="flex space-x-4 mt-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unpaid" id="unpaid" />
                    <Label htmlFor="unpaid">Unpaid (Free)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="paid" id="paid" />
                    <Label htmlFor="paid">Paid</Label>
                  </div>
                </RadioGroup>
              </div>
              {isPaid && (
                <div>
                  <Label htmlFor="price">Price ($)</Label>
                  <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g., 49.99" step="0.01" min="0.01" required={isPaid}/>
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button type="submit"><Save className="mr-2 h-4 w-4" /> {editingCourse ? 'Save Changes' : 'Add Course'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCodeDialogOpen} onOpenChange={setIsCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Activation Codes</DialogTitle>
            <CardDescription>For course: {courseForCodeGeneration?.title}</CardDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="numCodesToGenerate">Number of Codes to Generate</Label>
              <Input 
                id="numCodesToGenerate" 
                type="number" 
                min="1" 
                max="100"
                value={numCodesToGenerate} 
                onChange={(e) => setNumCodesToGenerate(parseInt(e.target.value))} 
              />
            </div>
            <Button onClick={handleGenerateCodes}>Generate Codes</Button>
            {generatedCodesForDisplay.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                <h4 className="font-medium">Generated Codes:</h4>
                {generatedCodesForDisplay.map(code => (
                  <div key={code} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                    <span className="text-sm font-mono">{code}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleCopyCode(code)} title="Copy code">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
