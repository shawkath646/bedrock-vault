import { protocol } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import type { TransformCallback } from 'node:stream';
import type { DecryptionService } from './decrypt-metadata.main';
import type LoggerService from '@main/utils/logger';
import { ENC_ALGORITHM } from '@main/constant/crypto.constants';

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'bv-media',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
        }
    }
]);

// Fast-forward transform to support seek operations in AES-GCM
class RangeTransform extends Transform {
    private bytesToDiscard: number;
    private bytesRemaining: number;

    constructor(start: number, end: number) {
        super();
        this.bytesToDiscard = start;
        this.bytesRemaining = end - start + 1;
    }

    _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
        let currentChunk = chunk;

        if (this.bytesToDiscard > 0) {
            if (currentChunk.length <= this.bytesToDiscard) {
                this.bytesToDiscard -= currentChunk.length;
                return callback();
            } else {
                currentChunk = currentChunk.subarray(this.bytesToDiscard);
                this.bytesToDiscard = 0;
            }
        }

        if (this.bytesRemaining > 0) {
            if (currentChunk.length <= this.bytesRemaining) {
                this.bytesRemaining -= currentChunk.length;
                this.push(currentChunk);
                if (this.bytesRemaining === 0) {
                    this.push(null);
                }
                return callback();
            } else {
                const finalChunk = currentChunk.subarray(0, this.bytesRemaining);
                this.bytesRemaining = 0;
                this.push(finalChunk);
                this.push(null);
                return callback();
            }
        } else {
            return callback();
        }
    }
}

function getMimeType(ext: string): string {
    const map: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.csv': 'text/csv',
        '.xml': 'text/xml',
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css'
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
}

export class MediaServerService {
    private tokenMap = new Map<string, string>();
    private decryptionService: DecryptionService | null = null;
    private logger: LoggerService;

    constructor(logger: LoggerService) {
        this.logger = logger;
    }

    public setDecryptionService(service: DecryptionService) {
        this.decryptionService = service;
    }

    public registerMediaToken(virtualPath: string): string {
        const token = crypto.randomUUID();
        this.tokenMap.set(token, virtualPath);
        setTimeout(() => {
            this.tokenMap.delete(token);
        }, 3600000);
        return token;
    }

    public clearMediaTokens(): void {
        this.tokenMap.clear();
    }

    public registerMediaProtocol() {
        protocol.handle('bv-media', async (request) => {
            try {
                const url = new URL(request.url);
                if (!url.hostname.startsWith('stream')) {
                    return new Response('Not Found', { status: 404 });
                }

                const token = url.searchParams.get('token');
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!token || !uuidRegex.test(token)) {
                    return new Response('Unauthorized - Invalid Token', { status: 401 });
                }

                const virtualPath = this.tokenMap.get(token);
                if (!virtualPath) {
                    return new Response('Forbidden or Token Expired', { status: 403 });
                }

                if (!this.decryptionService) {
                    return new Response('Decryption service not initialized', { status: 500 });
                }

                const entry = this.decryptionService.getDecryptedFileKeyEntry(virtualPath);
                const activeFolder = this.decryptionService.getActiveSelectedFolder();

                if (!entry || !activeFolder) {
                    return new Response('File Not Found in Vault', { status: 404 });
                }

                const physicalPath = path.join(activeFolder, entry.encName);

                const fd = await fs.open(physicalPath, 'r');
                const stat = await fd.stat();
                const physicalFileSize = stat.size;

                if (physicalFileSize < 28) {
                    await fd.close();
                    return new Response('File corrupted', { status: 500 });
                }

                const authTag = Buffer.alloc(16);
                await fd.read(authTag, 0, 16, physicalFileSize - 16);
                await fd.close();

                const decipher = crypto.createDecipheriv(ENC_ALGORITHM, entry.key, entry.iv);
                decipher.setAuthTag(authTag);

                const logicalSize = entry.size;
                let start = 0;
                let end = logicalSize - 1;
                let isPartial = false;

                const rangeHeader = request.headers.get('Range');
                if (rangeHeader) {
                    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
                    if (match) {
                        start = parseInt(match[1], 10);
                        if (match[2]) {
                            end = parseInt(match[2], 10);
                        }
                        isPartial = true;
                    }
                }

                if (start >= logicalSize || end >= logicalSize || start > end) {
                    return new Response('Range Not Satisfiable', {
                        status: 416,
                        headers: { 'Content-Range': `bytes */${logicalSize}` }
                    });
                }

                const contentLength = end - start + 1;

                const readStream = createReadStream(physicalPath, {
                    start: 12,
                    end: physicalFileSize - 17,
                    highWaterMark: 1024 * 1024
                });

                const rangeTransform = new RangeTransform(start, end);
                const nodeStream = readStream.pipe(decipher).pipe(rangeTransform);

                const webStream = new ReadableStream({
                    start(controller) {
                        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
                        nodeStream.on('end', () => controller.close());
                        nodeStream.on('error', (err) => controller.error(err));
                    },
                    cancel() {
                        nodeStream.destroy();
                        decipher.destroy();
                        readStream.destroy();
                    }
                });

                const mimeType = getMimeType(entry.ext);

                const headers = new Headers();
                headers.set('Content-Type', mimeType);
                headers.set('Content-Length', contentLength.toString());
                headers.set('Accept-Ranges', 'bytes');
                headers.set('Cache-Control', 'no-store');
                headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(virtualPath))}"`);

                if (isPartial) {
                    headers.set('Content-Range', `bytes ${start}-${end}/${logicalSize}`);
                    return new Response(webStream, { status: 206, headers });
                } else {
                    return new Response(webStream, { status: 200, headers });
                }
            } catch (err) {
                void this.logger.error('MediaServer', `Error streaming media: ${err}`);
                return new Response('Internal Server Error', { status: 500 });
            }
        });
    }
}
