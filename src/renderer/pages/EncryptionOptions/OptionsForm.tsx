import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Switch } from "@renderer/components/ui/switch";
import { Button } from "@renderer/components/ui/button";
import { CircleQuestionMark, FolderOpen, Shield } from "lucide-react";
import type { EncryptionOptions } from "@shared/types/fileEncryption";
import { useNavigate } from "react-router-dom";
import { defaultOptions, encryptionLevels } from "@shared/constant/encryptionOptions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function OptionsForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<EncryptionOptions>(defaultOptions);

    useEffect(() => {
        let isMounted = true;

        const initLoad = async () => {
            try {
                const options = await window.encryptionOptions.getOptions();
                if (isMounted && options) {
                    setFormData(options);
                }
            } catch (error) {
                console.error("Failed to load encryption options:", error);
            }
        };

        void initLoad();

        return () => {
            isMounted = false;
        };
    }, []);

    const handlePickDirectory = async (targetField: keyof EncryptionOptions) => {
        const selectedPath = await window.encryptionOptions.selectOutputPath();
        if (selectedPath) {
            setFormData((prev) => ({
                ...prev,
                [targetField]: selectedPath,
            }));
        }
    };

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        await window.encryptionOptions.saveOptions(formData);
        navigate("/confirm-encryption");
    };

    return (
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-4">
                <div className="space-y-4 mb-8">
                    <Label className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Encryption Level
                    </Label>

                    <RadioGroup
                        value={formData.encryptionLevel}
                        onValueChange={(level) => setFormData((prev) => ({ ...prev, encryptionLevel: level }))}
                        className="flex flex-col gap-4"
                    >
                        {encryptionLevels.map((level) => (
                            <div key={level.id} className="flex items-start gap-3">
                                <div className="mt-1">
                                    <RadioGroupItem value={level.value || level.id} id={level.id} />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Label
                                            htmlFor={level.id}
                                            className="cursor-pointer font-medium text-gray-900 dark:text-gray-100"
                                        >
                                            {level.label}
                                        </Label>

                                        {level.tooltipMsg && (
                                            <Tooltip>
                                                <TooltipTrigger type="button" className="cursor-help">
                                                    <CircleQuestionMark className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    <p className="max-w-xs">{level.tooltipMsg}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>

                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {level.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <section className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="output-dir" className="text-sm font-medium text-foreground">
                                File Output Directory
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="output-dir"
                                    type="text"
                                    value={formData.fileOutputDirectory || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, fileOutputDirectory: e.target.value }))}
                                    placeholder="Select directory for encrypted files..."
                                    className="h-9 border-border/70 bg-muted/20 text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => handlePickDirectory('fileOutputDirectory')}
                                >
                                    <FolderOpen className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="key-dir" className="text-sm font-medium text-foreground">
                                Backup Key Save Directory
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="key-dir"
                                    type="text"
                                    value={formData.backupKeyDirectory || ""}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, keySaveDirectory: e.target.value }))}
                                    placeholder="Select directory for encryption keys..."
                                    className="h-9 border-border/70 bg-muted/20 text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => handlePickDirectory('backupKeyDirectory')}
                                >
                                    <FolderOpen className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {formData.encryptionLevel === 3 && (
                            <div className="space-y-2">
                                <Label htmlFor="file-key-dir" className="text-sm font-medium text-foreground">
                                    Backup File Key Save Directory
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="file-key-dir"
                                        type="text"
                                        value={formData.backupKeyFileDirectory || ""}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, backupFileKeyDirectory: e.target.value }))}
                                        placeholder="Select directory for backup file key..."
                                        className="h-9 border-border/70 bg-muted/20 text-xs"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        onClick={() => handlePickDirectory('backupKeyFileDirectory')}
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-medium text-foreground">Security Options</h3>

                        <div className="space-y-2">
                            {[
                                { id: "encryptFileNameAndDirectory", label: "Encrypt File Name & Directory" },
                                { id: "addTrap", label: "Add Trap" },
                                { id: "addToCloudSync", label: "Add to Cloud Sync" }
                            ].map(({ id, label }) => (
                                <div key={id} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                    <Label htmlFor={id} className="text-xs font-normal text-foreground cursor-pointer">
                                        {label}
                                    </Label>
                                    <Switch
                                        id={id}
                                        checked={formData[id as keyof EncryptionOptions] as boolean}
                                        onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, [id]: checked }))}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            <div className="shrink-0 border-t border-border/40 bg-background px-6 py-4 flex justify-end">
                <Button type="submit" size="lg" className="px-8 shadow-sm">
                    <Shield className="mr-2 h-4 w-4" />
                    Encrypt
                </Button>
            </div>
        </form>
    );
}