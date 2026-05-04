import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface AppConfig {
    outputDir: string
    cloudBackup: boolean
}

const defaultConfig: AppConfig = {
    outputDir: '',
    cloudBackup: false,
}

function getConfigPath(): string {
    return path.join(app.getPath('userData'), 'config.json')
}

export function isInitialized(): boolean {
    return fs.existsSync(getConfigPath())
}

export function saveConfig(partialConfig: Partial<AppConfig>): AppConfig {
    const config = {
        ...defaultConfig,
        ...partialConfig,
    }

    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
    return config
}

export const initializeApp = saveConfig