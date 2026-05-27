import type {
  HandleFileOptions,
  SelectedFile,
  FileSelectionOptions,
  SelectedFilesState,
} from "@shared/types/fileSelection";

import type { EncryptionOptions, EncryptionProgress, EncryptionStage } from "@shared/types/fileEncryption";
import type { AppConfig } from "@shared/types/global";
import type { PopupPayload } from "@shared/types/popup";

declare global {
  interface Window {
    appWindow: {
      minimize: () => Promise<void> | void;
      close: () => Promise<void> | void;
      openDevTools: () => Promise<void>;
      openPathWithSysApp: (path: string) => Promise<void>;
      onPopupShow: (callback: (payload: PopupPayload) => void) => () => void;
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
      ) => Promise<FileSelectionOptions>;

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

      getOptions: () => Promise<EncryptionOptions>;

      saveOptions: (
        config: Partial<EncryptionOptions>
      ) => Promise<void>;
    };

    encryptionProgress: {
      startEncryptionFlow: () => Promise<void>;
      abortEncryptionFlow: () => Promise<void>;
      onStageUpdate: (callback: (stage: EncryptionStage) => void) => () => void;
      onProgress: (callback: (fileList: EncryptionProgress[]) => void) => () => void;
    }
  }
}

export { };