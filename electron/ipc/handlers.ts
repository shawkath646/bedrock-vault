import { ipcMain, dialog } from 'electron'
import { getMainWindow } from '../windows/windowManager'
import { isInitialized, saveConfig } from '../handlers/initializeApp'
import { addFiles, addFolder, removeItem, clearSelectedItems, getAllSelectedItems, getCurrentPathFiles } from '../handlers/fileSelection'

export function registerIpcHandlers(): void {
    ipcMain.handle('window:minimize', () => {
        const window = getMainWindow()
        window?.minimize()
    })

    ipcMain.handle('window:close', () => {
        const window = getMainWindow()
        window?.close()
    })
    ipcMain.handle('isInitialized', isInitialized)

    ipcMain.handle('saveConfig', (_event, config) => {
        return saveConfig(config)
    })

    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })

        if (result.canceled) return null
        return result.filePaths[0]
    })

    ipcMain.handle('add-files', addFiles)
    ipcMain.handle('add-folder', addFolder)
    ipcMain.handle('remove-item', removeItem)
    ipcMain.handle('clear-selected-items', clearSelectedItems)
    ipcMain.handle('get-all-selected-items', getAllSelectedItems)
    ipcMain.handle('get-current-path-files', getCurrentPathFiles)
}
