import {
    ShieldCheck,
    Wand,
    FileLock2
} from "lucide-react";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from "@renderer/components/ui/card";

export default function StatusBox({
    filesEncrypted = 1204
}) {

    return (
        <Card className="relative overflow-hidden md:col-span-7 flex flex-col border-border/70 bg-card/95 shadow-sm">
            {/* Decorative Background */}
            <ShieldCheck
                className="absolute right-4 top-4 h-24 w-24 text-primary/5"
                strokeWidth={1.5}
            />

            <CardHeader className="space-y-2 pb-4">
                <CardTitle className="flex items-center text-lg text-foreground">
                    <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
                    Overview
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Status + Main Metric */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Files Protected
                        </p>

                        <div className="mt-1 flex items-center gap-2">
                            <FileLock2 className="h-5 w-5 text-primary" />

                            <span className="text-3xl font-bold tracking-tight">
                                {filesEncrypted.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>


                {/* Tip */}
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <Wand className="h-4 w-4 shrink-0 text-emerald-500" />

                    <span>
                        <strong>Pro Tip:</strong> Store your recovery keys in a
                        secure location and never share them with anyone.
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}