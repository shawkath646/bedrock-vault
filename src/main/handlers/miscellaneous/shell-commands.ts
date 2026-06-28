import { shell, type IpcMainInvokeEvent } from "electron";
import type FileSelectionService from "../file-selection/file-selection.handler";
import type { EncryptionOptionsService } from "../encryption/encryption-options.store";

const APPROVED_DOMAINS = ['github.com', 'shawkath646.pro', 'cloudburstlab.vercel.app'];

export class ShellCommandsService {
    private fileSelectionService: FileSelectionService;
    private encryptionOptionsService: EncryptionOptionsService;

    constructor(
        fileSelectionService: FileSelectionService,
        encryptionOptionsService: EncryptionOptionsService
    ) {
        this.fileSelectionService = fileSelectionService;
        this.encryptionOptionsService = encryptionOptionsService;
    }

    public async openExternalUrl(_: IpcMainInvokeEvent | undefined, url: string) {
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

    public async openPathWithSysApp(_: IpcMainInvokeEvent | undefined, filePath: string) {
        try {
            const { selectedFiles } = this.fileSelectionService.fetchAllSelectedItems();
            const options = await this.encryptionOptionsService.fetchEncryptionOptions();
            
            const isOutputFileDirectory = filePath === options.fileOutputDirectory;
            const isValidInputFile = selectedFiles.some(f => f.actualPath === filePath);

            if (!isValidInputFile && !isOutputFileDirectory) {
                console.error(`Blocked unauthorized file access request to: ${filePath}`);
                throw new Error(`Unauthorized file access request: ${filePath}`);
            }
            return shell.openPath(filePath);
        } catch (error) {
            console.error('Failed to open file with system app:', error);
            throw error;
        }
    }
}