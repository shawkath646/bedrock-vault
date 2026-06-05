import { BrowserWindow } from 'electron'
import { getAppAssetPath } from './utils/path.utils'
import logger from './utils/logger'


let mainWindow: BrowserWindow | null = null
let logsWindow: BrowserWindow | null = null
let logUrl: string | undefined = process.env.VITE_DEV_SERVER_URL;

interface CreateWindowOptions {
    devServerUrl?: string
}

export function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
    if (mainWindow) {
        mainWindow.focus()
        return mainWindow
    }

    if (options.devServerUrl) {
        logUrl = options.devServerUrl
    }

    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: false,
        icon: getAppAssetPath('icon'),
        webPreferences: {
            preload: getAppAssetPath('preload')
        },
        fullscreenable: false,
        resizable: false
    })

    void logger.info('WindowManager', 'Main window instance created')

    mainWindow.on('close', () => {
        void logger.info('WindowManager', 'Main window close event triggered')
    })

    mainWindow.on('closed', () => {
        void logger.info('WindowManager', 'Main window closed, tearing down logsWindow if active')
        mainWindow = null
        if (logsWindow) {
            logsWindow.close()
            logsWindow = null
        }
    })

    if (options.devServerUrl) {
        void mainWindow.loadURL(options.devServerUrl)
    } else {
        void mainWindow.loadFile(getAppAssetPath('dist'))
    }

    return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow
}

export function createLogsWindow(): BrowserWindow {
    if (logsWindow) {
        logsWindow.focus()
        return logsWindow
    }

    logsWindow = new BrowserWindow({
        width: 850,
        height: 600,
        title: 'System Logs',
        frame: false,
        webPreferences: {
            preload: getAppAssetPath('preload')
        },
        resizable: true
    })

    void logger.info('WindowManager', 'Logs window instance created')

    logsWindow.on('close', () => {
        void logger.info('WindowManager', 'Logs window close event triggered')
    })

    logsWindow.on('closed', () => {
        void logger.info('WindowManager', 'Logs window closed')
        logsWindow = null
    })

    if (logUrl) {
        void logsWindow.loadURL(`${logUrl}#/logs`)
    } else {
        void logsWindow.loadFile(getAppAssetPath('dist'), { hash: '/logs' })
    }

    return logsWindow;
}

