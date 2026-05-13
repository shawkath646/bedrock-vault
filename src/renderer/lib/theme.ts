import { useEffect, useContext, useCallback } from "react";
import { AppConfigContext } from "@renderer/contexts/AppConfigContext";

export type AppTheme = 'system' | 'light' | 'dark';

function applyAppTheme(theme: AppTheme): void {
    const root = document.documentElement;
    const systemMatchesDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = theme === 'dark' || (theme === 'system' && systemMatchesDark);

    root.classList.toggle('dark', shouldUseDark);
}

export default function useTheme() {
    const ctx = useContext(AppConfigContext);

    if (!ctx) {
        throw new Error("useTheme must be used within an AppConfigProvider");
    }

    const theme = ctx.config?.theme ?? 'system';

    const handleThemeChange = useCallback(async (value: AppTheme) => {
        await ctx.saveConfig({ theme: value });
        await ctx.revalidate();
    }, [ctx]);

    useEffect(() => {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const syncTheme = () => {
            applyAppTheme(theme as AppTheme);
        };

        syncTheme();

        darkModeQuery.addEventListener('change', syncTheme);

        return () => {
            darkModeQuery.removeEventListener('change', syncTheme);
        };
    }, [theme]);

    return { theme, handleThemeChange };
}