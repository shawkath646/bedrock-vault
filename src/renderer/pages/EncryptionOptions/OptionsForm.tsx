import { useEffect, useState, type SubmitEvent } from "react";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Switch } from "@renderer/components/ui/switch";
import { Button } from "@renderer/components/ui/button";
import { FolderOpen, Shield } from "lucide-react";
import type { EncryptionOptions } from "@shared/types/fileEncryption";
import { useNavigate } from "react-router-dom";
import { defaultOptions } from "@shared/constant/encryptionOptions";

export default function OptionsForm() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState<EncryptionOptions>(defaultOptions);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;

        const loadOptions = async () => {
            const options = await window.encryptionOptions.getOptions();
            if (active) {
                setFormData(options);
            }
        };

        void loadOptions();

        return () => {
            active = false;
        };
    }, []);

    const pickDirectory = async () => {
        const selectedPath = await window.encryptionOptions.selectOutputPath();
        if (selectedPath) {
            setFormData((previous) => ({
                ...previous,
                fileOutputDirectory: selectedPath,
            }));
        }
    };

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!formData) return;

        setSubmitting(true);
        try {
            await window.encryptionOptions.saveOptions(formData);
            navigate("/confirm-encryption");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex h-full min-h-0 flex-col"
        >
            <div className="flex-1 space-y-4 overflow-y-auto px-6 lg:px-8 pb-4">
                <div className="grid grid-cols-2 gap-4">
                    <section className="space-y-2">
                        <Label htmlFor="key-dir" className="text-sm font-medium text-foreground">
                            Key Save Directory
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="key-dir"
                                type="text"
                                value={formData.keySaveDirectory}
                                onChange={(e) =>
                                    setFormData((prev) =>
                                        prev
                                            ? {
                                                ...prev,
                                                keySaveDirectory: e.target.value,
                                            }
                                            : prev
                                    )
                                }
                                placeholder="Select directory for encryption keys..."
                                className="h-8 border-none bg-muted/40 text-xs"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => pickDirectory()}
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="output-dir" className="text-sm font-medium text-foreground">
                                File Output Directory
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="output-dir"
                                    type="text"
                                    value={formData.fileOutputDirectory}
                                    onChange={(e) =>
                                        setFormData((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    fileOutputDirectory: e.target.value,
                                                }
                                                : prev
                                        )
                                    }
                                    placeholder="Select directory for encrypted files..."
                                    className="h-8 border-none bg-muted/40 text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => pickDirectory()}
                                >
                                    <FolderOpen className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-sm font-medium text-foreground">Security Options</h3>

                        <div className="space-y-3">
                            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-medium text-foreground">Encrypt File Header</p>
                                    <Switch
                                        checked={formData.encryptFileHeader}
                                        onCheckedChange={(checked) =>
                                            setFormData((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        encryptFileHeader: checked,
                                                    }
                                                    : prev
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-medium text-foreground">Encrypt File Name & Directory</p>
                                    <Switch
                                        checked={formData.encryptFileNameAndDirectory}
                                        onCheckedChange={(checked) =>
                                            setFormData((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        encryptFileNameAndDirectory: checked,
                                                    }
                                                    : prev
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-medium text-foreground">Add Trap</p>
                                    <Switch
                                        checked={formData.addTrap}
                                        onCheckedChange={(checked) =>
                                            setFormData((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        addTrap: checked,
                                                    }
                                                    : prev
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-medium text-foreground">Add to Cloud Sync</p>
                                    <Switch
                                        checked={formData.addToCloudSync}
                                        onCheckedChange={(checked) =>
                                            setFormData((prev) =>
                                                prev
                                                    ? {
                                                        ...prev,
                                                        addToCloudSync: checked,
                                                    }
                                                    : prev
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div className="shrink-0 bg-background px-4 py-4 flex justify-end">
                <Button
                    type="submit"
                    size="lg"
                    className="w-auto px-8"
                    disabled={submitting}
                >
                    Encrypt
                    <Shield className="mr-2 h-5 w-5" />
                </Button>
            </div>
        </form>
    );
}