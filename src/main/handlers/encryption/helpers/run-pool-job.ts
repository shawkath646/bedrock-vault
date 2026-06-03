import type { MessagePort } from 'node:worker_threads';
import { encryptFileStream } from './encrypt-file-core';

interface WorkerInput {
    sourceFilePath: string;
    encryptedOutputPath: string;
    rawKeyHex: string;
    port: MessagePort;
}

export default async function runPoolJob({
    sourceFilePath,
    encryptedOutputPath,
    rawKeyHex,
    port,
}: WorkerInput): Promise<{ ivHex: string; authTagHex: string }> {
    const result = await encryptFileStream({
        sourceFilePath,
        encryptedOutputPath,
        rawKeyHex,
        onProgress: (percent) => port.postMessage({ type: 'progress', percent }),
    });

    port.close();
    return result;
}
