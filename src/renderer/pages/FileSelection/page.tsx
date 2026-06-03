import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
    File,
    ArrowLeft,
    ArrowRight,
    FileText,
    HardDrive
} from 'lucide-react';
import { Button } from "@renderer/components/ui/button";
import FileOptions from './FileOptions';
import FileSelection from './FileSelection';
import { useNavigate } from 'react-router-dom';
import TitleBar from '@renderer/components/navigation/Titlebar';
import { defaultOptions } from '@shared/constant/fileSelection';
import type { SelectedFile, FileSelectionOptions } from '@shared/types/fileSelection';
import { formatSize } from '@renderer/lib/formatSize';

interface FileMetadata {
    totalSize: number;
    fileCount: number;
}

export default function FileSelectionPage() {
    const navigate = useNavigate();
    const [fileState, setFileState] = useState<SelectedFile[]>([]);
    const [metadata, setMetadata] = useState<FileMetadata>({ fileCount: 0, totalSize: 0 });

    const {
        register,
        control,
        setError,
        reset,
        handleSubmit,
        formState: { errors },
    } = useForm<FileSelectionOptions>({
        defaultValues: defaultOptions,
    });

    const options = useWatch({ control });

    useEffect(() => {
        let active = true;

        const loadSelectionState = async () => {
            try {
                const [state, rootFiles] = await Promise.all([
                    window.fileSelection.getState(),
                    window.fileSelection.getCurrentPathFiles(null)
                ]);

                if (!active) return;

                setFileState(rootFiles);
                setMetadata({ fileCount: state.fileCount, totalSize: state.totalSize });
                reset(state.options);
            } catch (err) {
                console.error("Failed to load selection state:", err);
            }
        };

        void loadSelectionState();
        return () => { active = false; };
    }, [reset]);

    const onSubmit = async (data: FileSelectionOptions) => {
        const response = await window.fileSelection.saveOptions(data);
        if (response.success) {
            navigate('/encryption-options');
        } else {
            Object.entries(response.errors).forEach(([field, messages]) => {
                setError(field as keyof FileSelectionOptions, {
                    type: "server",
                    message: messages.join(", "),
                });
            });
        }
    };

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
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <File className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                File Selection
                            </h1>
                        </div>
                    </div>
                }
            />

            <div className="mx-auto max-w-7xl px-6 mt-2 space-y-4">
                <FileOptions control={control} register={register} errors={errors} />
                <FileSelection
                    files={fileState}
                    setFiles={setFileState}
                    setMetadata={setMetadata}
                    options={options as FileSelectionOptions || defaultOptions}
                    hasFiles={!!metadata.fileCount}
                />

                {metadata.fileCount > 0 && (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-6 text-xs">
                            <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Total Files:</span>
                                <span className="font-semibold text-foreground">{metadata.fileCount}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <HardDrive className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Total Size:</span>
                                <span className="font-semibold text-foreground">
                                    {formatSize(metadata.totalSize)}
                                </span>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="w-full sm:w-auto px-8"
                            onClick={handleSubmit(onSubmit)}
                        >
                            Next
                            <ArrowRight className="w-5 h-5 mr-2" />
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}