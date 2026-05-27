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
	onPopupShow: (callback: (payload: PopupPayload) => void): (() => void) => {
		const listener = (_: Electron.IpcRendererEvent, payload: PopupPayload) => callback(payload);
		ipcRenderer.on('popup:show', listener);
		return () => ipcRenderer.removeListener('popup:show', listener);
	},
})

contextBridge.exposeInMainWorld("appConfig", {
	getAppConfig: () => ipcRenderer.invoke("get-app-config"),
	saveAppConfig: (config: Partial<AppConfig>) => ipcRenderer.invoke('save-app-config', config),
});

contextBridge.exposeInMainWorld("fileSelection", {
	getState: () => ipcRenderer.invoke('get-selected-files-state') as Promise<SelectedFilesState>,
	saveOptions: (config: Partial<FileSelectionOptions>) => ipcRenderer.invoke('save-selected-files-options', config) as Promise<FileSelectionOptions>,
	addFiles: (options: HandleFileOptions) => ipcRenderer.invoke("add-selected-files", options),
	addFolder: (options: HandleFileOptions) => ipcRenderer.invoke("add-selected-folder", options),
	removeItem: (path: string) => ipcRenderer.invoke('remove-selected-item', path),
	clearAll: () => ipcRenderer.invoke('clear-selected-items'),
	getCurrentPathFiles: (currentPath: string | null) => ipcRenderer.invoke("get-current-path-files", currentPath)
});

contextBridge.exposeInMainWorld("encryptionOptions", {
	getOptions: () => ipcRenderer.invoke('get-encryption-options'),
	saveOptions: (config: Partial<EncryptionOptions>) => ipcRenderer.invoke('save-encryption-options', config),
	selectOutputPath: () => ipcRenderer.invoke('select-encrypted-output-directory'),
});

contextBridge.exposeInMainWorld("encryptionProgress", {
	startEncryptionFlow: () => ipcRenderer.invoke("start-encryption-flow"),
	abortEncryptionFlow: () => ipcRenderer.invoke("abort-encryption-flow"),
	onStageUpdate: (callback: (stage: EncryptionStage) => void): (() => void) => {
		const listener = (_: Electron.IpcRendererEvent, status: EncryptionStage) => {
			callback(status);
		};
		ipcRenderer.on("encryption-stage-update", listener);
		return () => ipcRenderer.removeListener("encryption-stage-update", listener);
	},
	onProgress: (callback: (fileList: EncryptionProgress[]) => void): (() => void) => {
		const progressListener = (_event: Electron.IpcRendererEvent, fileList: EncryptionProgress[]) => {
			callback(fileList);
		};

		ipcRenderer.on("encryption-file-progress", progressListener);

		return () => {
			ipcRenderer.removeListener("encryption-file-progress", progressListener);
		};
	}
});