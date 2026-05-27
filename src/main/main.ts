import { app } from 'electron'
import { createWindow, getMainWindow } from './windows/windowManager'
import { registerIpcHandlers } from './ipc/handlers'
import { initializeFileSelectionHandler } from './handlers/file-selection/file-selection.handler'
import logger from './utils/logger'
import metadata from '@shared/constant/metadata.json'

function setupSingleInstanceLock(): boolean {

  const gotLock = app.requestSingleInstanceLock()

  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', () => {

    const mainWindow = getMainWindow()

    if (mainWindow) {

      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }

      mainWindow.show()
      mainWindow.focus()

      return
    }

    if (app.isReady()) {
      createWindow({
        devServerUrl: process.env.VITE_DEV_SERVER_URL
      })
    }

  })

  return true
}

if (setupSingleInstanceLock()) {

  registerIpcHandlers()

  app.whenReady().then(async () => {

    await logger.initialize();
    await initializeFileSelectionHandler()

    await logger.info("APP_START", `version=${metadata.version}`);

    createWindow({
      devServerUrl: process.env.VITE_DEV_SERVER_URL
    })

  })

}