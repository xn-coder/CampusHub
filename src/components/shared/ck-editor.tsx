
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface CKEditorProps {
    value: string;
    onChange: (data: string) => void;
    disabled?: boolean;
}

const Editor: React.FC<CKEditorProps> = ({ value, onChange, disabled }) => {
    const editorRef = useRef<any>(null);
    const [isEditorLoaded, setIsEditorLoaded] = useState(false);

    useEffect(() => {
        // This check ensures we only try to require the editor on the client-side.
        if (typeof window !== 'undefined') {
            editorRef.current = {
                CKEditor: require('@ckeditor/ckeditor5-react').CKEditor,
                ClassicEditor: require('@ckeditor/ckeditor5-build-classic'),
            };
            setIsEditorLoaded(true);
        }
    }, []);

    const { CKEditor, ClassicEditor } = editorRef.current || {};

    if (!isEditorLoaded) {
        return (
             <div className="space-y-2 rounded-md border p-4">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        );
    }

    return (
        <CKEditor
            editor={ClassicEditor}
            data={value}
            disabled={disabled}
            onChange={(event: any, editor: any) => {
                const data = editor.getData();
                onChange(data);
            }}
            config={{
                 toolbar: [
                    'heading', '|',
                    'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|',
                    'outdent', 'indent', '|',
                    'blockQuote', 'insertTable', 'undo', 'redo'
                ]
            }}
        />
    );
};

export default Editor;
