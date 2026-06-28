import { useSearchParams } from 'react-router-dom';
import TitleBar from '@renderer/components/navigation/Titlebar';
import { Music, FileWarning } from 'lucide-react';
import appIcon from "@/assets/icon.svg";
import { useMemo, useState } from 'react';

export default function PreviewPage() {
    const [searchParams] = useSearchParams();

    const srcRaw = searchParams.get('src');
    const token = searchParams.get('token');

    const [error, setError] = useState(false);

    // Common event blocker for right-clicks and dragging
    const blockInteraction = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    // Directly decode the URL since the backend handles one-time tokenization
    const src = useMemo(() => {
        if (!srcRaw) return null;
        return decodeURIComponent(srcRaw);
    }, [srcRaw]);

    if (!src || !token) {
        return (
            <div className="flex flex-col h-screen w-screen bg-background text-foreground">
                <TitleBar />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">Invalid Preview Request</p>
                </div>
            </div>
        );
    }

    // Determine type
    const srcLower = src.toLowerCase();
    const isVideo = ['.mp4', '.webm', '.ogg'].some(ext => srcLower.includes(ext));
    const isAudio = ['.mp3', '.wav'].some(ext => srcLower.includes(ext));
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some(ext => srcLower.includes(ext));
    const isDocument = ['.pdf', '.txt', '.md', '.json', '.csv', '.xml', '.html', '.js', '.css'].some(ext => srcLower.includes(ext));

    return (
        // Block right-clicks globally on the wrapper
        <div 
            className="flex flex-col h-screen w-screen overflow-hidden group bg-background text-foreground select-none"
            onContextMenu={blockInteraction}
        >
            <TitleBar
                component={
                    <div className="flex items-center space-x-2 pl-2 pointer-events-none">
                        <img
                            src={appIcon}
                            height={20}
                            width={20}
                            alt="App Icon"
                            className="shrink-0"
                        />
                        <p className="text-sm font-semibold tracking-tight text-foreground">Preview</p>
                    </div>
                }
            />

            <div className="flex-1 flex items-center justify-center relative w-full h-full overflow-hidden p-0">
                {error ? (
                    <div className="flex flex-col items-center text-center gap-4 text-muted-foreground bg-card p-12 rounded-3xl border border-border shadow-2xl backdrop-blur-md">
                        <div className="p-4 bg-red-500/10 rounded-full">
                            <FileWarning className="w-12 h-12 text-red-500/80" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Playback Error</h2>
                            <p className="text-sm mt-2 max-w-sm text-muted-foreground">The media could not be loaded. It may be corrupted, or the session token has expired.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {isVideo && (
                            <div className="relative w-full h-full bg-black">
                                <video
                                    src={src}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                    onError={() => setError(true)}
                                    controlsList="nodownload nofullscreen noremoteplayback"
                                    disablePictureInPicture
                                    onDragStart={blockInteraction}
                                />
                            </div>
                        )}

                        {isAudio && (
                            <div className="w-full max-w-md bg-card p-8 rounded-3xl border border-border shadow-2xl backdrop-blur-xl flex flex-col items-center">
                                <div className="relative flex justify-center mb-8 w-full pointer-events-none">
                                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                                    <div className="relative w-24 h-24 rounded-full bg-linear-to-tr from-blue-500/20 to-purple-500/20 flex items-center justify-center shadow-inner border border-white/5">
                                        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shadow-lg animate-[pulse_3s_ease-in-out_infinite]">
                                            <Music className="w-8 h-8 text-blue-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full relative">
                                    <audio
                                        src={src}
                                        controls
                                        autoPlay
                                        controlsList="nodownload"
                                        className="w-full outline-none [&::-webkit-media-controls-panel]:bg-zinc-800 [&::-webkit-media-controls-panel]:rounded-xl"
                                        onError={() => setError(true)}
                                    />
                                </div>
                            </div>
                        )}

                        {isImage && (
                            <div className="w-full h-full p-4 flex items-center justify-center relative">
                                <img
                                    src={src}
                                    alt="Decrypted Preview"
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl pointer-events-none"
                                    onError={() => setError(true)}
                                    onDragStart={blockInteraction}
                                />
                                {/* Invisible shield over image to catch any stray interactions */}
                                <div className="absolute inset-0 z-10" onContextMenu={blockInteraction}></div>
                            </div>
                        )}

                        {isDocument && (
                            <div className="w-full h-full bg-white relative">
                                <iframe
                                    src={`${src}#toolbar=0`}
                                    className="w-full h-full border-none"
                                    onError={() => setError(true)}
                                    title="Document Preview"
                                />
                            </div>
                        )}

                        {!isVideo && !isAudio && !isImage && !isDocument && (
                            <div className="flex flex-col items-center text-center gap-4 text-muted-foreground bg-card p-12 rounded-3xl border border-border shadow-2xl backdrop-blur-md">
                                <div className="p-4 bg-muted rounded-full">
                                    <FileWarning className="w-12 h-12 text-muted-foreground" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-foreground">Unsupported Format</h2>
                                    <p className="text-sm mt-2 max-w-sm text-muted-foreground">This file format cannot be previewed directly in the browser. Please export it to view.</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}