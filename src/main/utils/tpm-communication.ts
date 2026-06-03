import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let nativePrompt: {
    tpmEncrypt: (data: Buffer) => Buffer
    tpmDecrypt: (data: Buffer) => Buffer
    isTpmAvailable: () => boolean
    isSoftwareKspAvailable: () => boolean
} | null = null

function getNativePrompt() {
    if (nativePrompt === null) {
        try {
            nativePrompt = require('../native/native_prompt.node');
        } catch (error) {
            console.error("Failed to load native module native_prompt.node:", error);
            nativePrompt = null;
        }
    }
    return nativePrompt;
}

export function tpmEncrypt(data: Buffer): Buffer {
    const prompt = getNativePrompt();
    if (!prompt) {
        throw new Error("Native module not available for TPM encryption.");
    }
    return prompt.tpmEncrypt(data)
}

export function tpmDecrypt(data: Buffer): Buffer {
    const prompt = getNativePrompt();
    if (!prompt) {
        throw new Error("Native module not available for TPM decryption.");
    }
    return prompt.tpmDecrypt(data)
}

export function isTpmAvailable(): boolean {
    const prompt = getNativePrompt();
    if (!prompt) return false;
    try {
        return prompt.isTpmAvailable();
    } catch (err) {
        console.error("TPM check error:", err);
        return false;
    }
}

export function isSoftwareKspAvailable(): boolean {
    const prompt = getNativePrompt();
    if (!prompt) return false;
    try {
        return prompt.isSoftwareKspAvailable();
    } catch (err) {
        console.error("Software KSP check error:", err);
        return false;
    }
}