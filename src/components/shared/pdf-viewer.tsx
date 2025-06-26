"use client";

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// For react-pdf v8, use pdf.worker.min.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
  const { toast } = useToast();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function onDocumentLoadError(error: Error) {
    console.error("Error loading PDF:", error);
    toast({
      title: "Error loading PDF",
      description: "Could not load the PDF file. It might be corrupted or inaccessible.",
      variant: "destructive",
    });
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

  return (
    <div className="flex flex-col h-full w-full bg-muted/20">
      <div className="flex items-center justify-center gap-2 p-2 bg-card border-b sticky top-0 z-10">
        <Button variant="outline" size="icon" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Zoom Out">
            <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium w-16 text-center">{(scale * 100).toFixed(0)}%</span>
        <Button variant="outline" size="icon" onClick={zoomIn} disabled={scale >= 3.0} aria-label="Zoom In">
            <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-grow overflow-auto flex justify-center p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          error={<div className="flex items-center justify-center h-full w-full text-destructive">Failed to load PDF.</div>}
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              scale={scale}
              renderTextLayer={false}
              className="mb-4 shadow-lg"
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
