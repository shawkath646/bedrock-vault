import { useState } from 'react';
import {
    Lock,
    ArrowLeft
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import FileOptions from './FileOptions';
import FileSelection from './FileSelection';
import { useNavigate } from 'react-router-dom';
import BottomSubmitBar from './BottomSubmitBar';
import TitleBar from '@/components/navigation/Titlebar';
import { type FileSelectionOptions, defaultOptions } from './values';
import type { SelectedFile } from '@shared/types/fileSelection';


export default function EncryptSelectionPage() {
    const navigate = useNavigate();

    const [options, setOptions] = useState<FileSelectionOptions>(defaultOptions);
    const [files, setFiles] = useState<SelectedFile[]>([]);

    return (
        <>
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary shadow-sm border border-primary/10">
                                <Lock className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                File Selection
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="mx-auto max-w-7xl px-6 mt-2">
                <FileOptions options={options} setOptions={setOptions} />
                <FileSelection files={files} setFiles={setFiles} options={options} />
                <BottomSubmitBar files={files} />
            </div>
        </>
    );
}