import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';

type SetupConfig = {
    outputDir: string;
    cloudBackup: boolean;
}

export default function Step2() {

    const [config, setConfig] = useState<SetupConfig>({
        outputDir: 'C:\\Vault\\Encrypted',
        cloudBackup: false,
    });

    const pickOutputDir = async () => {
        const selectedPath = await window.api.selectFolder();
        if (selectedPath) {
            setConfig((current) => ({ ...current, outputDir: selectedPath }));
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    Configure
                </h2>
            </div>

            <div className="space-y-3">
                <div>
                    <Label htmlFor="output-dir" className="text-xs font-medium text-muted-foreground">
                        Output directory
                    </Label>
                    <div className="mt-1.5 flex gap-2">
                        <Input
                            id="output-dir"
                            value={config.outputDir}
                            onChange={(event) => setConfig((current) => ({ ...current, outputDir: event.target.value }))}
                            className="h-8 border-none bg-muted/40 text-xs"
                            placeholder="C:\\Vault\\Encrypted"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={pickOutputDir}
                        >
                            <FolderOpen className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-foreground">Cloud backup</p>
                            <p className="text-xs leading-4 text-muted-foreground">
                                Auto-sync encrypted files remotely.
                            </p>
                        </div>
                        <Switch
                            id="cloud-backup"
                            checked={config.cloudBackup}
                            onCheckedChange={(checked) =>
                                setConfig((current) => ({ ...current, cloudBackup: checked }))
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}