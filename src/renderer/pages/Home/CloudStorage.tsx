import { Button } from "@renderer/components/ui/button";
import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Cloud, RefreshCw, Settings } from "lucide-react";

export default function CloudStorage() {
    return (
        <Card className="md:col-span-5 flex flex-col border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="flex items-center text-lg text-foreground">
                    <Cloud className="mr-2 h-5 w-5 text-primary" />
                    Cloud Sync
                </CardTitle>
                <Badge variant="secondary" className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active
                </Badge>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between space-y-6">
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Cloud Storage Connected</p>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-bold text-foreground">500</p>
                            <p className="mb-1 font-medium text-muted-foreground">GB</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Last Backup On</p>
                        <p className="font-medium text-foreground">Oct 24, 2024 at 03:00 AM</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-6">
                    <Button variant="secondary" size="lg">
                        <Settings className="mr-2 h-4 w-4" />
                        Manage
                    </Button>

                    <Button className="flex-1" size="lg">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Instant Backup
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}