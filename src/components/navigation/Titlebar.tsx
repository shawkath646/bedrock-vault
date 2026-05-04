import { useEffect, useState } from 'react';
import { Minus, Square, X, Ellipsis } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { applyAppTheme, getAppTheme, setAppTheme, type AppTheme } from '@/lib/theme';

export default function TitleBar({ component }: { component?: React.ReactElement }) {

    const [theme, setTheme] = useState<AppTheme>(() => getAppTheme());

    useEffect(() => {
        applyAppTheme(theme);
    }, [theme]);

    function minimize() { window.electron?.minimize?.() }
    function closeWin() { window.electron?.close?.() }

    const handleThemeChange = (value: string) => {
        if (value === 'system' || value === 'light' || value === 'dark') {
            setTheme(value);
            setAppTheme(value);
        }
    };


    return (
        <div className="titlebar flex justify-between w-full select-none">
            <div className="disable-titlebar-drag">
                {component}
            </div>
            <div className="flex items-center gap-2 disable-titlebar-drag self-start pt-1">
                <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-blue-500/20 transition-colors">
                        <Ellipsis className="w-4 h-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56">

                        {/* 👤 User Card */}
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

                        {/* 🎨 Theme Section */}
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
                                Theme
                            </DropdownMenuLabel>

                            <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                                <DropdownMenuRadioItem value="system">
                                    System
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="light">
                                    Light
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="dark">
                                    Dark
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>

                    </DropdownMenuContent>
                </DropdownMenu>
                <button onClick={minimize} className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Minimize"><Minus className="w-4 h-4" /></button>
                <button disabled className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground hover:bg-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Maximize"><Square className="w-3.5 h-3.5" /></button>
                <button onClick={closeWin} className="inline-flex items-center justify-center w-8.5 h-7 rounded-md bg-transparent border border-transparent text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/75" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
        </div>
    );
}