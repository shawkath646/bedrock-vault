import type {
  HandleFileOptions,
  SelectedFile,
  FileSelectionOptions,
  SelectedFilesState,
} from "@shared/types/fileSelection";

import type { EncryptionOptions, EncryptionProgress, EncryptionStage, EncryptionRecord } from "@shared/types/fileEncryption";
import type { AppConfig, SaveResult, AppData } from "@shared/types/global";
import type { PopupPayload } from "@shared/types/popup";
import type { CloudStatus } from "@shared/types/cloudDrive";

export interface DecryptedFileEntry {
  name: string;
  encName: string;
  virtualPath: string;
  size: number;
  ext: string;
  thumbnail: string;
  isAvailable: boolean;
}

export type DecryptionResult = 
  | { success: true; files: DecryptedFileEntry[]; chunkName: string }
  | { success: false; error: string; level?: number };

declare global {
  interface Window {
    appWindow: {
      minimize: () => Promise<void> | void;
      close: () => Promise<void> | void;
      openDevTools: () => Promise<void>;
      openPathWithSysApp: (path: string) => Promise<void>;
      getAppUpdateInfo: () => Promise<{ lastUpdate: string; currentVersion: string; latestVersion: string; updateUrl: string }>;
      openExternalUrl: (url: string) => Promise<void>;
      onPopupShow: (callback: (payload: PopupPayload) => void) => () => void;
      getAppData: () => Promise<AppData>;
    };

    appConfig: {
      getAppConfig: () => Promise<AppConfig>;
      saveAppConfig: (
        config: Partial<AppConfig>
      ) => Promise<AppConfig>;
    };

    fileSelection: {
      getState: () => Promise<SelectedFilesState>;

      saveOptions: (
        config: Partial<FileSelectionOptions>
      ) => Promise<SaveResult<FileSelectionOptions>>;

      addFiles: (
        options: HandleFileOptions
      ) => Promise<void>;

      addFolder: (
        options: HandleFileOptions
      ) => Promise<void>;

      removeItem: (path: string) => Promise<void>;

      clearAll: () => Promise<void>;

      getCurrentPathFiles: (
        currentPath: string | null
      ) => Promise<SelectedFile[]>;
    };

    encryptionOptions: {
      selectOutputPath: () => Promise<string | null>;
      selectRecoveryPhraseSavePath: () => Promise<string | null>;
      selectFileKeySavePath: () => Promise<string | null>;

      getOptions: () => Promise<EncryptionOptions>;

      saveOptions: (
        config: Partial<EncryptionOptions>
      ) => Promise<SaveResult<EncryptionOptions>>;

      promptAndSetPassword: () => Promise<boolean>;
      hasEncryptionPassword: () => Promise<boolean>;
      clearEncryptionPassword: () => Promise<void>;
      isTpmAvailable: () => Promise<boolean>;
      isSoftwareKspAvailable: () => Promise<boolean>;
    };

    encryptionProgress: {
      startEncryptionFlow: () => Promise<void>;
      abortEncryptionFlow: () => Promise<void>;
      onStageUpdate: (callback: (stage: EncryptionStage) => void) => () => void;
      onProgress: (callback: (fileList: EncryptionProgress[]) => void) => () => void;
    },
    
    cloudDrive: {
      getCloudStatus: () => Promise<CloudStatus>
    };

    appLogs: {
      log: (type: "INFO" | "WARN" | "ERROR", op: string, msg: string) => Promise<void>;
      fetchLogs: () => Promise<{ main: string; renderer: string; logsDir: string }>;
      viewFolder: () => Promise<void>;
      openWindow: () => Promise<void>;
      onLogUpdate: (callback: (data: { fileType: "main" | "renderer"; line: string }) => void) => () => void;
    };

    decryptFiles: {
      getRecords: () => Promise<EncryptionRecord[]>;
      encryptedDirectorySelect: (directoryPath?: string) => Promise<DecryptionResult>;
    };
  }
}

export { };