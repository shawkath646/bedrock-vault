import appMetadata from '@shared/constant/metadata.json';
import { Lock, Tag, User, ExternalLink } from 'lucide-react';

export default function Step0() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="w-full max-w-2xl space-y-12">
                
                {/* Hero Section */}
                <div className="flex flex-col items-center space-y-6 text-center">
                    
                    {/* Colorful Gradient Icon Block */}
                    <div className="flex items-center justify-center w-16 h-16 shadow-xl rounded-2xl bg-linear-to-br from-blue-500 to-violet-600 shadow-blue-500/20 dark:shadow-none">
                        <Lock className="w-8 h-8 text-white" />
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                            {appMetadata.name}
                        </h1>
                        <p className="max-w-md mx-auto text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                            Let’s get everything configured in a few quick steps so the app is ready to use right away.
                        </p>
                    </div>
                </div>

                {/* Metadata Cards Section */}
                <div className="grid max-w-lg grid-cols-1 gap-4 mx-auto sm:grid-cols-2">
                    
                    {/* Version Card */}
                    <div className="flex flex-col items-center p-5 space-y-3 text-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-500">
                                Version
                            </p>
                            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {appMetadata.version}
                            </p>
                        </div>
                    </div>

                    {/* Author Card */}
                    <a 
                        href={appMetadata.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center p-5 space-y-3 text-center"
                    >
                        <div className="flex items-center justify-center w-10 h-10 transition-transform rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-500">
                                Author
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">
                                {appMetadata.author.name}
                                <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                            </div>
                        </div>
                    </a>

                </div>
            </div>
        </div>
    );
}