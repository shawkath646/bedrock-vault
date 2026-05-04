import { Button } from '@/components/ui/button';
import {
    Shield,
    FileText,
    HardDrive
} from 'lucide-react';
import type { SelectedFile } from '@shared/types/fileSelection';
import { formatSize } from '@/lib/formatSize';

export default function BottomSubmitBar({ files }: { files: SelectedFile[] }) {
    const totalSize = files.reduce((sum, file) => sum + (file.isDir ? 0 : file.size), 0);

    return (
        <div className="flex items-center justify-between gap-4">
            {/* Stats */}
            <div className="flex items-center space-x-6 text-xs">
                <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total Files:</span>
                    <span className="font-semibold text-foreground">{files.length}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total Size:</span>
                    <span className="font-semibold text-foreground">
                        {formatSize(totalSize)}
                    </span>
                </div>
            </div>

            {/* Action Button */}
            <Button size="lg" className="w-full sm:w-auto px-8" disabled={files.length === 0}>
                <Shield className="w-5 h-5 mr-2" />
                Next
            </Button>
        </div>
    );
}