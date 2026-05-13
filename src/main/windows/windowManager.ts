import { BrowserWindow } from 'electron'
import { getPreloadPath, getDistPath } from '../utils/paths'

let mainWindow: BrowserWindow | null = null

interface CreateWindowOptions {
    devServerUrl?: string
}

export function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
    if (mainWindow) {
        mainWindow.focus()
        return mainWindow
    }

    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: false,
        webPreferences: {
            preload: getPreloadPath()
        },
        fullscreenable: false,
        resizable: false
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    if (options.devServerUrl) {
        void mainWindow.loadURL(options.devServerUrl)
    } else {
        void mainWindow.loadFile(getDistPath())
    }

    return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow
}

export function closeWindow(): void {
    if (mainWindow) {
        mainWindow.close()
        mainWindow = null
    }
}

