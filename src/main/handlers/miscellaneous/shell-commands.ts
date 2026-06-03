import { shell, type IpcMainInvokeEvent } from "electron";
import { fetchAllSelectedItems } from "../file-selection/file-selection.handler";


const APPROVED_DOMAINS = ['github.com', 'shawkath646.pro', 'cloudburstlab.vercel.app'];

export const openExternalUrl = (_: IpcMainInvokeEvent, url: string) => {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error(`Blocked unsafe protocol scheme: ${parsedUrl.protocol}`);
        }

        const hostname = parsedUrl.hostname.toLowerCase();

        const isAllowed = APPROVED_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );

        if (!isAllowed) {
            throw new Error(`Blocked unauthorized domain access: ${hostname}`);
        }

        return shell.openExternal(url);
    } catch (error) {
        console.error('Failed to open external URL:', error);
        throw error;
    }
}

export const openPathWithSysApp = (_: IpcMainInvokeEvent, filePath: string) => {
    try {
        const { selectedFiles } = fetchAllSelectedItems();
        const isValid = selectedFiles.some(f => f.actualPath === filePath);
        if (!isValid) {
            console.error(`Blocked unauthorized file access request to: ${filePath}`);
            throw new Error(`Unauthorized file access request: ${filePath}`);
        }
        return shell.openPath(filePath);
    } catch (error) {
        console.error('Failed to open file with system app:', error);
        throw error;
    }
}