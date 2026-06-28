import { Input } from "@renderer/components/ui/input";
import { Switch } from "@renderer/components/ui/switch";
import { Controller } from "react-hook-form";
import type { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import type { FileSelectionOptions } from "@shared/types/file-selection";
import { Field, FieldLabel, FieldError } from "@renderer/components/ui/field";

interface FileOptionsProps {
    control: Control<FileSelectionOptions>;
    register: UseFormRegister<FileSelectionOptions>;
    errors: FieldErrors<FileSelectionOptions>;
}

const FILE_TYPE_OPTIONS = [
    { id: "documents", label: "Documents" },
    { id: "audio", label: "Audio" },
    { id: "video", label: "Video" },
    { id: "pictures", label: "Pictures" },
    { id: "programs", label: "Programs" },
    { id: "others", label: "Others" },
] as const;

export default function FileOptions({ control, register, errors }: FileOptionsProps) {
    return (
        <div className="flex gap-8 items-start w-full">
            <div className="w-80 shrink-0 space-y-2">
                {/* Chunk Name Block */}
                <div className="h-16">
                    <Field aria-invalid={!!errors.chunkName}>
                        <FieldLabel htmlFor="chunk-name">
                            Chunk Name
                        </FieldLabel>
                        <Input
                            id="chunk-name"
                            {...register("chunkName")}
                            placeholder="e.g. MyBackupChunk"
                            className="h-8 text-xs bg-muted/40 border-none"
                        />
                        <FieldError errors={[errors.chunkName]} />
                    </Field>
                </div>

                <Field orientation="horizontal">
                    <FieldLabel htmlFor="include-subfolders">
                        Include Subfolders
                    </FieldLabel>
                    <Controller
                        control={control}
                        name="includeSubFolders"
                        render={({ field }) => (
                            <Switch
                                id="include-subfolders"
                                checked={Boolean(field.value)}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </Field>
            </div>

            <div className="flex-1 flex gap-8 items-end p-2">
                <div className="flex-1 space-y-2">
                    <FieldLabel className="text-xs text-muted-foreground">File Types</FieldLabel>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-8">
                        {FILE_TYPE_OPTIONS.map(({ id, label }) => (
                            <Field key={id} orientation="horizontal" className="flex items-center justify-between gap-4">
                                <FieldLabel htmlFor={id} className="text-xs">{label}</FieldLabel>
                                <Controller
                                    control={control}
                                    name={id as keyof FileSelectionOptions}
                                    render={({ field }) => (
                                        <Switch
                                            id={id}
                                            checked={Boolean(field.value)}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </Field>
                        ))}
                    </div>
                </div>

                {/* Sub-Section: Max Size Config (Moved here to save bottom space) */}
                <div className="w-44 shrink-0">
                    <Field aria-invalid={!!errors.maxSize} className="space-y-2">
                        <FieldLabel htmlFor="max-size" className="text-xs text-muted-foreground">
                            Max Size (MB)
                        </FieldLabel>
                        <Input
                            id="max-size"
                            type="number"
                            {...register("maxSize", { valueAsNumber: true })}
                            placeholder="0"
                            className="h-8 text-xs bg-muted/40 border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <FieldError errors={[errors.maxSize]} />
                    </Field>
                </div>
            </div>
        </div>
    );
}