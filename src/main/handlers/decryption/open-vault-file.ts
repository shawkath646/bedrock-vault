import type { IpcMainInvokeEvent } from "electron";
import type WindowManager from "@main/window-manager";
import type { LoggerService } from "@main/utils/logger";
import type { DecryptionService } from "./decrypt-metadata.main";
import type { MediaServerService } from "./media-server";

export class VaultFileService {
    private decryptionService: DecryptionService;
    private mediaServerService: MediaServerService;
    private windowManager: WindowManager;
    private logger: LoggerService;

    constructor(
        decryptionService: DecryptionService,
        mediaServerService: MediaServerService,
        windowManager: WindowManager,
        logger: LoggerService
    ) {
        this.decryptionService = decryptionService;
        this.mediaServerService = mediaServerService;
        this.windowManager = windowManager;
        this.logger = logger;
    }

    public async openVaultFile(_event: IpcMainInvokeEvent | undefined, virtualPath: string) {
        try {
            const entry = this.decryptionService.getDecryptedFileKeyEntry(virtualPath);
            if (!entry) {
                return { success: false, error: 'FILE_NOT_FOUND' };
            }
            
            const token = this.mediaServerService.registerMediaToken(virtualPath);
            const ext = entry.ext.startsWith('.') ? entry.ext : `.${entry.ext}`;
            const streamUrl = `bv-media://stream${ext}?token=${token}`;
            
            this.windowManager.createPreviewWindow(streamUrl, token);
            
            return { success: true };
        } catch (err) {
            void this.logger.error('openVaultFile', `Error opening file: ${err}`);
            return { success: false, error: 'INTERNAL_ERROR' };
        }
    }
}