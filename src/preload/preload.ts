import type { HandleFileOptions } from '@shared/types/fileSelection'
import type { FileSelectionOptions, SelectedFilesState } from '@shared/types/fileSelection'
import type { EncryptionOptions, EncryptionProgress, EncryptionStage } from '@shared/types/fileEncryption'
import type { AppConfig } from '@shared/types/global'
import type { PopupPayload } from '@shared/types/global'
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('appWindow', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  openPathWithSysApp: (path: string) => ipcRenderer.invoke('open-file-with-sys-app', path),
  getAppUpdateInfo: () => ipcRenderer.invoke('get-app-update-info'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  getAppData: () => ipcRenderer.invoke('get-app-data'),
  onPopupShow: (callback: (payload: PopupPayload) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: PopupPayload) => callback(payload)
    ipcRenderer.on('popup:show', listener)
    return () => ipcRenderer.removeListener('popup:show', listener)
  }
})

contextBridge.exposeInMainWorld('appConfig', {
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  saveAppConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('save-app-config', config)
})

contextBridge.exposeInMainWorld('fileSelection', {
  getState: () => ipcRenderer.invoke('get-selected-files-state') as Promise<SelectedFilesState>,
  saveOptions: (config: Partial<FileSelectionOptions>) => ipcRenderer.invoke('save-selected-files-options', config) as Promise<FileSelectionOptions>,
  addFiles: (options: HandleFileOptions) => ipcRenderer.invoke('add-selected-files', options),
  addFolder: (options: HandleFileOptions) => ipcRenderer.invoke('add-selected-folder', options),
  removeItem: (path: string) => ipcRenderer.invoke('remove-selected-item', path),
  clearAll: () => ipcRenderer.invoke('clear-selected-items'),
  getCurrentPathFiles: (currentPath: string | null) => ipcRenderer.invoke('get-current-path-files', currentPath)
})

contextBridge.exposeInMainWorld('encryptionOptions', {
  getOptions: () => ipcRenderer.invoke('get-encryption-options'),
  saveOptions: (config: Partial<EncryptionOptions>) => ipcRenderer.invoke('save-encryption-options', config),
  selectOutputPath: () => ipcRenderer.invoke('select-encrypted-output-directory'),
  selectRecoveryPhraseSavePath: () => ipcRenderer.invoke('select-recovery-phrase-save-path'),
  selectFileKeySavePath: () => ipcRenderer.invoke('select-file-key-save-path'),
  promptAndSetPassword: () => ipcRenderer.invoke('prompt-and-set-password'),
  hasEncryptionPassword: () => ipcRenderer.invoke('has-encryption-password'),
  clearEncryptionPassword: () => ipcRenderer.invoke('clear-encryption-password'),
  isTpmAvailable: () => ipcRenderer.invoke('is-tpm-available'),
  isSoftwareKspAvailable: () => ipcRenderer.invoke('is-software-ksp-available')
})

contextBridge.exposeInMainWorld('encryptionProgress', {
  startEncryptionFlow: () => ipcRenderer.invoke('start-encryption-flow'),
  abortEncryptionFlow: () => ipcRenderer.invoke('abort-encryption-flow'),
  onStageUpdate: (callback: (stage: EncryptionStage) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, status: EncryptionStage) => callback(status)
    ipcRenderer.on('encryption-stage-update', listener)
    return () => ipcRenderer.removeListener('encryption-stage-update', listener)
  },
  onProgress: (callback: (fileList: EncryptionProgress[]) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, fileList: EncryptionProgress[]) => callback(fileList)
    ipcRenderer.on('encryption-file-progress', listener)
    return () => ipcRenderer.removeListener('encryption-file-progress', listener)
  }
})

contextBridge.exposeInMainWorld('cloudDrive', {
  getCloudStatus: () => ipcRenderer.invoke('get-cloud-status')
})

contextBridge.exposeInMainWorld('appLogs', {
  log: (type: 'INFO' | 'WARN' | 'ERROR', op: string, msg: string) => ipcRenderer.invoke('app-log', type, op, msg),
  fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
  viewFolder: () => ipcRenderer.invoke('view-logs-folder'),
  openWindow: () => ipcRenderer.invoke('open-logs-window'),
  onLogUpdate: (callback: (data: { fileType: 'main' | 'renderer'; line: string }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { fileType: 'main' | 'renderer'; line: string }) => callback(data)
    ipcRenderer.on('log-updated', listener)
    return () => ipcRenderer.removeListener('log-updated', listener)
  }
})

contextBridge.exposeInMainWorld('decryptFiles', {
  getRecords: () => ipcRenderer.invoke('decrypt-files:get-records'),
  encryptedDirectorySelect: (directoryPath?: string) => ipcRenderer.invoke('decrypt-files:encrypted-directory-select', directoryPath)
})