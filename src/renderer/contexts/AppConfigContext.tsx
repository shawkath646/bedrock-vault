import type { AppConfig } from "@shared/types/global";
import { createContext, useState, useCallback, type ReactNode } from "react";

type AppConfigContextType = {
    config: AppConfig | null;
    saveConfig: (partialConfig: Partial<AppConfig>) => Promise<AppConfig>;
    revalidate: () => Promise<AppConfig>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AppConfigContext = createContext<AppConfigContextType | null>(null);

export function AppConfigProvider({
    children,
    initialConfig,
}: {
    children: ReactNode;
    initialConfig: AppConfig;
}) {
    const [config, setConfig] = useState<AppConfig | null>(initialConfig);

    const revalidate = useCallback(async () => {
        const fresh = await window.appConfig.getAppConfig();
        setConfig(fresh);
        return fresh;
    }, []);

    const saveConfig = useCallback(async (partialConfig: Partial<AppConfig>) => {
        const saved = await window.appConfig.saveAppConfig(partialConfig);
        setConfig(saved);
        return saved;
    }, []);

    if (!AppConfigContext) throw new Error("Missing AppConfigProvider");

    return (
        <AppConfigContext.Provider value={{ config, saveConfig, revalidate }}>
            {children}
        </AppConfigContext.Provider>
    );
}