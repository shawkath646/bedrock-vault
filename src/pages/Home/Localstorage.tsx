import {
    Database,
    Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, ResponsiveContainer, Tooltip} from 'recharts';

export default function LocalStorage() {

    const storageData = [
        { name: 'Used Space', value: 45, fill: 'var(--primary)' },
        { name: 'Free Space', value: 55, fill: 'var(--border)' },
    ];

    return (
        <Card className="md:col-span-7 flex flex-col border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="space-y-2 pb-4">
                <CardTitle className="flex items-center text-lg text-foreground">
                    <Database className="mr-2 h-5 w-5 text-primary" />
                    Local Storage Overview
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-stretch lg:gap-6">
                <div className="w-48 h-48 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={storageData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            />
                            <Tooltip
                                formatter={(value) => [`${value}%`, 'Storage']}
                                contentStyle={{
                                    borderRadius: '8px',
                                    backgroundColor: 'var(--popover)',
                                    color: 'var(--popover-foreground)',
                                    border: '1px solid var(--border)'
                                }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">45%</span>
                        <span className="text-xs text-muted-foreground">Used</span>
                    </div>
                </div>

                {/* Storage Stats */}
                <div className="w-full flex-1 space-y-3">
                    <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground mb-1">Total Available Storage</p>
                        <p className="text-2xl font-semibold text-foreground">256 GB</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Encrypted Files</p>
                            <p className="text-xl font-semibold text-indigo-500">1,204</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                            <p className="text-xs text-muted-foreground mb-2">Last Modified</p>
                            <div className="flex items-center text-foreground">
                                <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium">2 hours ago</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}