import fs from "fs-extra";
import { app } from "electron";
import path from "path";

let initialized = false;
let initializing: Promise<void> | null = null;
let currentLogPath: string | null = null;

type LogType = "INFO" | "WARN" | "ERROR";

const logsDir = path.join(app.getPath("appData"), "LOG");

const writeLog = async (type: LogType, operation: string, metadata: string): Promise<void> => {
    if (!initialized) {
        await initialize();
    }

    if (!currentLogPath) return;

    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} [${type.padEnd(5, " ")}] ${operation.padEnd(30, " ")} ${metadata}\n`;

    try {
        await fs.appendFile(currentLogPath, logLine, "utf8");
    } catch (err) {
        console.error("Failed to write log:", err);
    }
};

export const info = (op: string, msg: string) => writeLog("INFO", op, msg);
export const warn = (op: string, msg: string) => writeLog("WARN", op, msg);
export const error = (op: string, msg: string) => writeLog("ERROR", op, msg);

export const initialize = async (): Promise<void> => {
    if (initialized) return;

    if (initializing) {
        await initializing;
        return;
    }

    initializing = (async () => {
        const logName = new Date().toISOString().replace(/[:.]/g, "-");

        currentLogPath = path.join(logsDir, `${logName}.log`);

        const latestLogPath = path.join(logsDir, "latest.log");

        await fs.ensureDir(logsDir);
        await fs.writeFile(currentLogPath, "", "utf8");
        await fs.remove(latestLogPath);

        try {
            await fs.symlink(currentLogPath, latestLogPath, "file");
        } catch { /* empty */ }

        initialized = true;
    })();

    await initializing;
    initializing = null;
};

const logger = {
    initialize,
    info,
    warn,
    error,
};

export default logger;