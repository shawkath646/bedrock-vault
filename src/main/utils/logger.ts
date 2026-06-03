import fs from "node:fs/promises";
import { app, shell, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import path from "path";

let initialized = false;
let initializing: Promise<void> | null = null;
let currentMainLogPath: string | null = null;
let currentRendererLogPath: string | null = null;

type LogType = "INFO" | "WARN" | "ERROR";

const logsDir = path.join(app.getPath("userData"), "logs");

const pathExists = async (p: string): Promise<boolean> => {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
};

const writeLog = async (fileType: "main" | "renderer", type: LogType, operation: string, metadata: string): Promise<void> => {
    if (!initialized) {
        await initialize();
    }

    const targetPath = fileType === "main" ? currentMainLogPath : currentRendererLogPath;
    if (!targetPath) return;

    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} [${type.padEnd(5, " ")}] ${operation.padEnd(30, " ")} ${metadata}\n`;

    try {
        await fs.appendFile(targetPath, logLine, "utf8");
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                win.webContents.send("log-updated", {
                    fileType,
                    line: logLine.trim()
                });
            }
        }
    } catch (err) {
        console.error(`Failed to write ${fileType} log:`, err);
    }
};

export const info = (op: string, msg: string) => writeLog("main", "INFO", op, msg);
export const warn = (op: string, msg: string) => writeLog("main", "WARN", op, msg);
export const error = (op: string, msg: string) => writeLog("main", "ERROR", op, msg);

export const logRenderer = (_:IpcMainInvokeEvent,  type: LogType, op: string, msg: string) => writeLog("renderer", type, op, msg);

export const initialize = async (): Promise<void> => {
    if (initialized) return;

    if (initializing) {
        await initializing;
        return;
    }

    initializing = (async () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        await fs.mkdir(logsDir, { recursive: true });

        currentMainLogPath = path.join(logsDir, `main-${timestamp}.log`);
        currentRendererLogPath = path.join(logsDir, `renderer-${timestamp}.log`);

        const latestMainPath = path.join(logsDir, "main-latest.log");
        const latestRendererPath = path.join(logsDir, "renderer-latest.log");

        await fs.writeFile(currentMainLogPath, "", "utf8");
        await fs.writeFile(currentRendererLogPath, "", "utf8");

        await fs.rm(latestMainPath, { force: true });
        await fs.rm(latestRendererPath, { force: true });

        try {
            await fs.symlink(currentMainLogPath, latestMainPath, "file");
        } catch { /* empty */ }

        try {
            await fs.symlink(currentRendererLogPath, latestRendererPath, "file");
        } catch { /* empty */ }

        initialized = true;
    })();

    await initializing;
    initializing = null;
};

export const fetchLogs = async () => {
    try {
        let mainPath: string | null = currentMainLogPath;
        let rendererPath: string | null = currentRendererLogPath;

        if (!mainPath || !rendererPath) {
            await fs.mkdir(logsDir, { recursive: true });
            const files = await fs.readdir(logsDir);
            const mainFiles = files.filter(f => f.startsWith("main-") && f.endsWith(".log")).sort();
            const rendererFiles = files.filter(f => f.startsWith("renderer-") && f.endsWith(".log")).sort();

            if (mainFiles.length > 0) {
                mainPath = path.join(logsDir, mainFiles[mainFiles.length - 1]);
            }
            if (rendererFiles.length > 0) {
                rendererPath = path.join(logsDir, rendererFiles[rendererFiles.length - 1]);
            }
        }

        const mainContent = mainPath && await pathExists(mainPath) ? await fs.readFile(mainPath, "utf8") : "";
        const rendererContent = rendererPath && await pathExists(rendererPath) ? await fs.readFile(rendererPath, "utf8") : "";

        return {
            main: mainContent,
            renderer: rendererContent,
            logsDir
        };
    } catch (err) {
        console.error("Failed to fetch logs:", err);
        return { main: "", renderer: "", logsDir };
    }
};

export const viewLogsFolder = async () => {
    try {
        await shell.openPath(logsDir);
    } catch (err) {
        console.error("Failed to open logs folder:", err);
    }
};

const logger = {
    initialize,
    info,
    warn,
    error,
    logRenderer,
    fetchLogs,
    viewLogsFolder
};

export default logger;