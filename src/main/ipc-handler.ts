import { ipcMain, BrowserWindow } from 'electron'
import { getMainWindow, createLogsWindow } from './window-manager'
import { logRenderer, fetchLogs, viewLogsFolder } from './utils/logger'
import { fetchAppConfiguration, updateAppConfiguration } from './handlers/config/app-config.handler'
import {
    fetchEncryptionOptions,
    selectRecoveryPhraseSavePath,
    selectEncryptionOutputDirectory,
    updateEncryptionOptions,
    selectFileKeySavePath,
} from './handlers/encryption/encryption-options.store'
import { abortEncryption, setEncryptionPassword, hasEncryptionPassword, clearCachedPassword } from './handlers/encryption/helpers/abort-controller.helper'
import { handleStartEncryptionWorkflow } from './handlers/encryption/encryption-workflow.main'
import {
    clearSelectedItems,
    fetchCurrentPathSelectedFiles,
    fetchSelectedFilesState,
    handleFileSelectionAddFiles,
    handleFileSelectionAddFolder,
    handleFileSelectionRemoveItem,
    updateFileSelectionOptions,
} from './handlers/file-selection/file-selection.handler'
import { popupEmitter } from './handlers/miscellaneous/popup.emitter'
import { encryptionEmitter } from "./handlers/encryption/helpers/encryption-emitter.helper";
import { getCloudStatus } from '@main/handlers/cloud-sync/status'
import { isTpmAvailable, isSoftwareKspAvailable } from '@main/utils/native-crypto'
import { openExternalUrl, openPathWithSysApp } from '@main/handlers/miscellaneous/shell-commands'
import { getAppMetadata, getAppUpdateInfo } from './handlers/miscellaneous/miscellaneous'
import { getRecords, removeRecord, addRecord } from './utils/enc-record'
import decryptMetadata, { clearDecryptedCache, fetchCurrentPathDecryptedFiles } from './handlers/decryption/decrypt-metadata.main'
import { pingActivity, startSecurityTimer, stopSecurityTimer } from './handlers/decryption/helpers/auto-locker.helpers'
import { openVaultFile } from './handlers/webdav/webdav.handler'



export function registerIpcHandlers(): void {
    // Window Management
    ipcMain.handle('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
    ipcMain.handle('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())
    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
        ipcMain.handle('open-dev-tools', () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }))
    }

    // System / Shell
    ipcMain.handle('open-file-with-sys-app', openPathWithSysApp)
    ipcMain.handle('open-external-url', openExternalUrl)

    // Configuration & Updates
    ipcMain.handle('get-app-config', fetchAppConfiguration)
    ipcMain.handle('save-app-config', updateAppConfiguration)
    ipcMain.handle('get-app-update-info', getAppUpdateInfo)
    ipcMain.handle('get-cloud-status', getCloudStatus)
    ipcMain.handle('get-app-data', getAppMetadata)

    // File Selection
    ipcMain.handle('get-selected-files-state', fetchSelectedFilesState)
    ipcMain.handle('save-selected-files-options', updateFileSelectionOptions)
    ipcMain.handle('add-selected-files', handleFileSelectionAddFiles)
    ipcMain.handle('add-selected-folder', handleFileSelectionAddFolder)
    ipcMain.handle('remove-selected-item', handleFileSelectionRemoveItem)
    ipcMain.handle('clear-selected-items', clearSelectedItems)
    ipcMain.handle('get-current-path-files', fetchCurrentPathSelectedFiles)

    // Encryption Setup
    ipcMain.handle('get-encryption-options', fetchEncryptionOptions)
    ipcMain.handle('save-encryption-options', updateEncryptionOptions)
    ipcMain.handle('select-encrypted-output-directory', selectEncryptionOutputDirectory)
    ipcMain.handle('select-recovery-phrase-save-path', selectRecoveryPhraseSavePath)
    ipcMain.handle('select-file-key-save-path', selectFileKeySavePath)
    ipcMain.handle('prompt-and-set-password', setEncryptionPassword)
    ipcMain.handle('has-encryption-password', hasEncryptionPassword)
    ipcMain.handle('clear-encryption-password', clearCachedPassword)
    ipcMain.handle('is-tpm-available', isTpmAvailable)
    ipcMain.handle('is-software-ksp-available', isSoftwareKspAvailable)

    // Encryption Workflow
    ipcMain.handle('start-encryption-flow', handleStartEncryptionWorkflow)
    ipcMain.handle('abort-encryption-flow', abortEncryption)

    // Encryption Record Management
    ipcMain.handle('encryption-record:get-records', getRecords)
    ipcMain.handle('encryption-record:add-record', addRecord)
    ipcMain.handle('encryption-record:remove-record', removeRecord)

    // Decryption Workflow
    ipcMain.handle('decryption:decrypt-metadata', decryptMetadata)
    ipcMain.handle('decryption:get-current-path-files', fetchCurrentPathDecryptedFiles)
    ipcMain.handle('decryption:open-vault-file', openVaultFile)
    ipcMain.handle('decryption:lock-vault', clearDecryptedCache)
    ipcMain.on('start-security-timer', () => startSecurityTimer())
    ipcMain.on('stop-security-timer', () => stopSecurityTimer())
    ipcMain.on('ping-activity', () => pingActivity())

    // Logging & Tools (Fixed the serialization bug here)
    ipcMain.handle('app-log', logRenderer)
    ipcMain.handle('fetch-logs', fetchLogs)
    ipcMain.handle('view-logs-folder', viewLogsFolder)
    ipcMain.handle('open-logs-window', createLogsWindow)

    // Main -> Renderer Events (Emitters)
    encryptionEmitter.on('stage', (status) => getMainWindow()?.webContents.send('encryption-stage-update', status))
    encryptionEmitter.on('file-progress', (fileList) => getMainWindow()?.webContents.send('encryption-file-progress', fileList))
    popupEmitter.on('show', (payload) => getMainWindow()?.webContents.send('popup:show', payload))
}