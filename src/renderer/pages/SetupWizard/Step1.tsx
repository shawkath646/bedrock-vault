import { 
    ShieldOff, 
    WifiOff, 
    Lock, 
    Cloud, 
    FolderLock, 
    ShieldCheck
} from "lucide-react";

export default function Step1() {
    return (
        <div className="flex flex-col w-full max-w-2xl gap-8 p-6 mx-auto">
            {/* Header */}
            <div className="text-center space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Core Features
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Everything you need to keep your data secure.
                </p>
            </div>

            {/* Features Grid - 2 Columns on larger screens, 1 on mobile */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                
                {/* Feature 1: Zero Knowledge */}
                <div className="p-4 transition-colors bg-white border shadow-sm rounded-xl dark:bg-black border-zinc-200 dark:border-zinc-800/80 hover:dark:border-zinc-700">
                    <div className="flex gap-4">
                        <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <ShieldOff className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                                Zero-Knowledge
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                No logging or key saving. We cannot access your data.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feature 2: Offline Capable */}
                <div className="p-4 transition-colors bg-white border shadow-sm rounded-xl dark:bg-black border-zinc-200 dark:border-zinc-800/80 hover:dark:border-zinc-700">
                    <div className="flex gap-4">
                        <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <WifiOff className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                                100% Offline
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                Encrypt locally without ever relying on cloud features.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feature 3: Advanced Encryption */}
                <div className="p-4 transition-colors bg-white border shadow-sm rounded-xl dark:bg-black border-zinc-200 dark:border-zinc-800/80 hover:dark:border-zinc-700">
                    <div className="flex gap-4">
                        <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                                Advanced Encryption
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                Choose from multiple industry-standard encryption methods.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feature 4: Comprehensive Protection */}
                <div className="p-4 transition-colors bg-white border shadow-sm rounded-xl dark:bg-black border-zinc-200 dark:border-zinc-800/80 hover:dark:border-zinc-700">
                    <div className="flex gap-4">
                        <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <FolderLock className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                                Deep Protection
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                Secures headers, filenames, and entire directory trees.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feature 5: Cloud Sync (Spans full width if odd number of items) */}
                <div className="p-4 transition-colors bg-white border shadow-sm rounded-xl dark:bg-black border-zinc-200 dark:border-zinc-800/80 hover:dark:border-zinc-700 sm:col-span-2">
                    <div className="flex gap-4">
                        <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Cloud className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
                                Secure Cloud Sync
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                Safely back up your encrypted vaults to prevent any data loss.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Refined Bottom Footer */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Your privacy is absolute. Your files belong only to you.</span>
            </div>
        </div>
    );
}