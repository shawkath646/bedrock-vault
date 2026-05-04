import type { HandleFileOptions, SelectedFile } from "@shared/types/fileSelection";

interface SetupConfig {
  outputDir: string;
  cloudBackup: boolean;
}

interface SelectedItemsSummary {
  items: SelectedFile[];
  totalSize: number;
  fileCount: number;
}

declare global {
  interface Window {
    electron?: {
      minimize?: () => Promise<void> | void;
      close?: () => void;
    };

    api: {
      selectFolder: () => Promise<string | null>;
      isInitialized: () => Promise<boolean>;
      saveConfig: (config: Partial<SetupConfig>) => Promise<SetupConfig>;
      addFiles: (options: HandleFileOptions) => Promise<void>;
      addFolder: (options: HandleFileOptions) => Promise<void>;
      removeItem: (path: string) => Promise<void>;
      clearSelectedItems: () => Promise<void>;
      getAllSelectedItems: () => Promise<SelectedItemsSummary>;
      getCurrentPathFiles: (currentPath: string) => Promise<SelectedFile[]>;
    };
  }
}