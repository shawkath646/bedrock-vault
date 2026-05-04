import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { type FileSelectionOptions } from "./values";

export default function FileOptions({
    options,
    setOptions
}: {
    options: FileSelectionOptions,
    setOptions: React.Dispatch<React.SetStateAction<FileSelectionOptions>>
}) {

    return (
        <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-80 space-y-4 p-2">

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="include-subfolders" className="text-xs font-light">
                            Include Subfolders
                        </Label>
                        <Switch id="include-subfolders" checked={options.includeSubFolders} onCheckedChange={(v) => setOptions(o => ({ ...o, includeSubFolders: Boolean(v) }))} />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="new-chunk" className="text-xs">New Chunk</Label>
                    <Switch id="new-chunk" checked={options.newChunk} onCheckedChange={(v) => setOptions(o => ({ ...o, newChunk: Boolean(v) }))} />
                </div>

                <div className="h-16">
                    {options.newChunk ? (
                        <div className="space-y-2">
                            <Label htmlFor="chunk-name" className="text-xs text-muted-foreground">
                                Chunk Name
                            </Label>
                            <Input
                                id="chunk-name"
                                value={options.chunkName}
                                onChange={(e) => setOptions(o => ({ ...o, chunkName: e.target.value }))}
                                placeholder="e.g. MyBackupChunk"
                                className="h-8 text-xs bg-muted/40 border-none"
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="select-chunk" className="text-xs text-muted-foreground">
                                Select Chunk
                            </Label>
                            <Select id="select-chunk">
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a fruit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Fruits</SelectLabel>
                                        <SelectItem value="apple">Apple</SelectItem>
                                        <SelectItem value="banana">Banana</SelectItem>
                                        <SelectItem value="blueberry">Blueberry</SelectItem>
                                        <SelectItem value="grapes">Grapes</SelectItem>
                                        <SelectItem value="pineapple">Pineapple</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 w-full md:w-80 mt-auto p-2">
                <Label className="text-xs text-muted-foreground">File Types</Label>

                <div className="grid grid-cols-2 gap-y-2 gap-x-10">


                    <div className="flex items-center justify-between">
                        <Label htmlFor="documents" className="text-xs">Documents</Label>
                        <Switch id="documents" checked={options.documents} onCheckedChange={(v) => setOptions(o => ({ ...o, documents: Boolean(v) }))} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="audio" className="text-xs">Audio</Label>
                        <Switch id="audio" checked={options.audio} onCheckedChange={(v) => setOptions(o => ({ ...o, audio: Boolean(v) }))} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="video" className="text-xs">Video</Label>
                        <Switch id="video" checked={options.video} onCheckedChange={(v) => setOptions(o => ({ ...o, video: Boolean(v) }))} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="pictures" className="text-xs">Pictures</Label>
                        <Switch id="pictures" checked={options.pictures} onCheckedChange={(v) => setOptions(o => ({ ...o, pictures: Boolean(v) }))} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="programs" className="text-xs">Programs</Label>
                        <Switch id="programs" checked={options.programs} onCheckedChange={(v) => setOptions(o => ({ ...o, programs: Boolean(v) }))} />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="others" className="text-xs">Others</Label>
                        <Switch id="others" checked={options.others} onCheckedChange={(v) => setOptions(o => ({ ...o, others: Boolean(v) }))} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="max-size" className="text-xs">
                        Max Size (MB)
                    </Label>
                    <Input
                        id="max-size"
                        type="number"
                        value={options.maxSize}
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            if (!Number.isFinite(value) || value < 0) return;
                            setOptions(o => ({ ...o, maxSize: value }));
                        }}
                        placeholder="0"
                        className="h-8 text-xs bg-muted/40 border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                </div>
            </div>
        </div>
    );
}