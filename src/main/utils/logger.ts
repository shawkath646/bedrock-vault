import fs from "node:fs/promises";
import { app, shell, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import path from "path";

type LogType = "INFO" | "WARN" | "ERROR";

export default class LoggerService {
    private initialized = false;
    private initializing: Promise<void> | null = null;
    private currentMainLogPath: string | null = null;
    private currentRendererLogPath: string | null = null;
    private logsDir: string;

    constructor() {
        this.logsDir = path.join(app.getPath("userData"), "logs");
    }

    private async pathExists(p: string): Promise<boolean> {
        try {
            await fs.access(p);
            return true;
        } catch {
            return false;
        }
    }

    private async writeLog(fileType: "main" | "renderer", type: LogType, operation: string, metadata: string): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        const targetPath = fileType === "main" ? this.currentMainLogPath : this.currentRendererLogPath;
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
    }

    public async info(op: string, msg: string): Promise<void> {
        return this.writeLog("main", "INFO", op, msg);
    }

    public async warn(op: string, msg: string): Promise<void> {
        return this.writeLog("main", "WARN", op, msg);
    }

    public async error(op: string, msg: string): Promise<void> {
        return this.writeLog("main", "ERROR", op, msg);
    }

    public async logRenderer(_: IpcMainInvokeEvent, type: LogType, op: string, msg: string): Promise<void> {
        return this.writeLog("renderer", type, op, msg);
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        if (this.initializing) {
            await this.initializing;
            return;
        }

        this.initializing = (async () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            await fs.mkdir(this.logsDir, { recursive: true });

            this.currentMainLogPath = path.join(this.logsDir, `main-${timestamp}.log`);
            this.currentRendererLogPath = path.join(this.logsDir, `renderer-${timestamp}.log`);

            const latestMainPath = path.join(this.logsDir, "main-latest.log");
            const latestRendererPath = path.join(this.logsDir, "renderer-latest.log");

            await fs.writeFile(this.currentMainLogPath, "", "utf8");
            await fs.writeFile(this.currentRendererLogPath, "", "utf8");

            await fs.rm(latestMainPath, { force: true });
            await fs.rm(latestRendererPath, { force: true });

            try {
                await fs.symlink(this.currentMainLogPath, latestMainPath, "file");
            } catch { /* empty */ }

            try {
                await fs.symlink(this.currentRendererLogPath, latestRendererPath, "file");
            } catch { /* empty */ }

            this.initialized = true;
        })();

        await this.initializing;
        this.initializing = null;
    }

    public async fetchLogs() {
        try {
            let mainPath: string | null = this.currentMainLogPath;
            let rendererPath: string | null = this.currentRendererLogPath;

            if (!mainPath || !rendererPath) {
                await fs.mkdir(this.logsDir, { recursive: true });
                const files = await fs.readdir(this.logsDir);
                const mainFiles = files.filter(f => f.startsWith("main-") && f.endsWith(".log")).sort();
                const rendererFiles = files.filter(f => f.startsWith("renderer-") && f.endsWith(".log")).sort();

                if (mainFiles.length > 0) {
                    mainPath = path.join(this.logsDir, mainFiles[mainFiles.length - 1]);
                }
                if (rendererFiles.length > 0) {
                    rendererPath = path.join(this.logsDir, rendererFiles[rendererFiles.length - 1]);
                }
            }

            const mainContent = mainPath && await this.pathExists(mainPath) ? await fs.readFile(mainPath, "utf8") : "";
            const rendererContent = rendererPath && await this.pathExists(rendererPath) ? await fs.readFile(rendererPath, "utf8") : "";

            return {
                main: mainContent,
                renderer: rendererContent,
                logsDir: this.logsDir
            };
        } catch (err) {
            console.error("Failed to fetch logs:", err);
            return { main: "", renderer: "", logsDir: this.logsDir };
        }
    }

    public async viewLogsFolder(): Promise<void> {
        try {
            await shell.openPath(this.logsDir);
        } catch (err) {
            console.error("Failed to open logs folder:", err);
        }
    }
}