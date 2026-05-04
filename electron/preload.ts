import type { HandleFileOptions } from '@shared/types/fileSelection'
import { contextBridge, ipcRenderer } from 'electron'

type SetupConfig = {
	outputDir: string
	cloudBackup: boolean
}

contextBridge.exposeInMainWorld('electron', {
	minimize: () => ipcRenderer.invoke('window:minimize'),
	close: () => ipcRenderer.invoke('window:close'),
})

contextBridge.exposeInMainWorld("api", {
	selectFolder: () => ipcRenderer.invoke("select-folder"),
	isInitialized: () => ipcRenderer.invoke("isInitialized"),
	saveConfig: (config: Partial<SetupConfig>) => ipcRenderer.invoke('saveConfig', config),
	addFiles: (options: HandleFileOptions) => ipcRenderer.invoke("add-files", options),
	addFolder: (options: HandleFileOptions) => ipcRenderer.invoke("add-folder", options),
	removeItem: (path: string) => ipcRenderer.invoke('remove-item', path),
	clearSelectedItems: () => ipcRenderer.invoke('clear-selected-items'),
	getAllSelectedItems: () => ipcRenderer.invoke("get-all-selected-items"),
	getCurrentPathFiles: (currentPath: string) => ipcRenderer.invoke("get-current-path-files", currentPath)
});