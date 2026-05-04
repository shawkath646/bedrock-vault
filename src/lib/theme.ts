export type AppTheme = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'app-theme';

export function getAppTheme(): AppTheme {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        return storedTheme;
    }

    return 'system';
}

export function setAppTheme(theme: AppTheme): void {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('app-theme-change', { detail: theme }));
}

export function applyAppTheme(theme: AppTheme): void {
    const root = document.documentElement;
    const systemMatchesDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = theme === 'dark' || (theme === 'system' && systemMatchesDark);

    root.classList.toggle('dark', shouldUseDark);
}
