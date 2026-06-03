export const info = (op: string, msg: string): Promise<void> => {
    return window.appLogs.log("INFO", op, msg);
};

export const warn = (op: string, msg: string): Promise<void> => {
    return window.appLogs.log("WARN", op, msg);
};

export const error = (op: string, msg: string): Promise<void> => {
    return window.appLogs.log("ERROR", op, msg);
};

const logger = {
    info,
    warn,
    error,
};

export default logger;
