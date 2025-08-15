
"use client";

import React, { useEffect, useRef } from 'react';

interface CKEditorProps {
    value: string;
    onChange: (data: string) => void;
    disabled?: boolean;
}

const Editor: React.FC<CKEditorProps> = ({ value, onChange, disabled }) => {
    const editorRef = useRef<any>(null);
    const { CKEditor, ClassicEditor } = editorRef.current || {};

    useEffect(() => {
        editorRef.current = {
            CKEditor: require('@ckeditor/ckeditor5-react').CKEditor,
            ClassicEditor: require('@ckeditor/ckeditor5-build-classic'),
        };
    }, []);

    if (!CKEditor) {
        return <div>Loading Editor...</div>;
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
