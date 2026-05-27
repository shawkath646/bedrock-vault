import { ipcMain, shell } from 'electron'
import { getMainWindow } from '../windows/windowManager'
import { fetchAppConfiguration, updateAppConfiguration } from '../handlers/config/app-config.handler'
import {
    fetchEncryptionOptions,
    selectEncryptionOutputDirectory,
    updateEncryptionOptions,
} from '../handlers/encryption/encryption-options.store'
import { abortEncryption, handleStartEncryptionWorkflow } from '../handlers/encryption/encryption-workflow.handler'
import {
    clearSelectedItems,
    fetchAllSelectedItems,
    fetchCurrentPathSelectedFiles,
    fetchSelectedFilesState,
    handleFileSelectionAddFiles,
    handleFileSelectionAddFolder,
    handleFileSelectionRemoveItem,
    updateFileSelectionOptions,
} from '../handlers/file-selection/file-selection.handler'
import { popupEmitter } from './popup.emitter'
import { encryptionEmitter } from "../handlers/encryption/helpers/encryption-emitter";

export function registerIpcHandlers(): void {

    ipcMain.handle('window:minimize', () => {
        getMainWindow()?.minimize()
    })

    ipcMain.handle('window:close', () => {
        getMainWindow()?.close()
    })

    ipcMain.handle('open-dev-tools', () => {
        getMainWindow()?.webContents.openDevTools({
            mode: 'detach'
        })
    });

    ipcMain.handle('open-file-with-sys-app', (_, path: string) => shell.openPath(path))

    ipcMain.handle('get-app-config', fetchAppConfiguration)
    ipcMain.handle('save-app-config', updateAppConfiguration)

    ipcMain.handle('get-selected-files-state', fetchSelectedFilesState)
    ipcMain.handle('save-selected-files-options', updateFileSelectionOptions)
    ipcMain.handle('add-selected-files', handleFileSelectionAddFiles)
    ipcMain.handle('add-selected-folder', handleFileSelectionAddFolder)
    ipcMain.handle('remove-selected-item', handleFileSelectionRemoveItem)
    ipcMain.handle('clear-selected-items', clearSelectedItems)
    ipcMain.handle('get-all-selected-items', fetchAllSelectedItems)
    ipcMain.handle('get-current-path-files', fetchCurrentPathSelectedFiles)

    ipcMain.handle('get-encryption-options', fetchEncryptionOptions)
    ipcMain.handle('save-encryption-options', updateEncryptionOptions)
    ipcMain.handle('select-encrypted-output-directory', selectEncryptionOutputDirectory)


    ipcMain.handle('start-encryption-flow', handleStartEncryptionWorkflow)
    ipcMain.handle('abort-encryption-flow', abortEncryption)

    encryptionEmitter.on('stage', (status) => {
        getMainWindow()?.webContents.send('encryption-stage-update', status);
    });

    encryptionEmitter.on('file-progress', (fileList) => {
        getMainWindow()?.webContents.send('encryption-file-progress', fileList);
    });

    popupEmitter.on('show', (payload) => {
        getMainWindow()?.webContents.send('popup:show', payload);
    });
}
