import { useLocation } from 'react-router-dom';
import { Minus, Square, X, Ellipsis, Code2, Info, Settings, RefreshCw, Logs } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
    DropdownMenuSubContent,
} from "@renderer/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from '@renderer/components/ui/avatar';

export default function TitleBar({ component }: { component?: React.ReactElement }) {

    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="titlebar flex justify-between w-full select-none bg-red-500">
            <div className="disable-titlebar-drag">
                {component}
            </div>
            <div className="flex items-center gap-2 disable-titlebar-drag self-start pt-1">
                {location.pathname === "/setup" || location.pathname === "/encryption-progress" || location.pathname === "/logs" ? null : (
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-blue-500/20 transition-colors">
                            <Ellipsis className="w-4 h-4" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-56">
                            <div className="p-0">
                                <div className="flex items-center gap-3 px-3 py-2">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src="/avatar.png" />
                                        <AvatarFallback>MF</AvatarFallback>
                                    </Avatar>

                                    <div className="flex flex-col leading-tight">
                                        <span className="text-sm font-medium">MARUF</span>
                                        <span className="text-xs text-muted-foreground">
                                            maruf@example.com
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <DropdownMenuSeparator />

                            <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => navigate('/update')} className="cursor-pointer flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Check for Updates</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => navigate('/about')} className="cursor-pointer flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    <span>About</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    <span>Settings</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="cursor-pointer flex items-center gap-2">
                                        <Code2 className="w-4 h-4" />
                                        <span>Developer Options</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                        <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={() => window.appLogs.openWindow()} className="cursor-pointer flex items-center gap-2">
                                                <Logs className="w-4 h-4" />
                                                <span>Show Logs</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => window.appWindow.openDevTools()} className="cursor-pointer flex items-center gap-2">
                                                <Code2 className="w-4 h-4" />
                                                <span>Developer Tools</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                </DropdownMenuSub>

                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <button onClick={() => window.appWindow.minimize()} className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Minimize"><Minus className="w-4 h-4" /></button>
                <button disabled className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Maximize"><Square className="w-3.5 h-3.5" /></button>
                <button onClick={() => window.appWindow.close()} className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/75" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
        </div>
    );
}