import { app } from 'electron'
import { createWindow, getMainWindow, setupWindowStateHandlers } from './windows/windowManager'
import { registerIpcHandlers } from './ipc/handlers'

function handleSingleInstanceLock(): void {
  const gotSingleInstanceLock = app.requestSingleInstanceLock()

  if (!gotSingleInstanceLock) {
    app.quit()
    return
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
      createWindow({ devServerUrl: process.env.VITE_DEV_SERVER_URL })
    }
  })
}

/**
 * Initialize the application
 */
function init(): void {
  handleSingleInstanceLock()
  registerIpcHandlers()

  app.whenReady().then(() => {
    createWindow({ devServerUrl: process.env.VITE_DEV_SERVER_URL })
    setupWindowStateHandlers()
  })
}

init()

