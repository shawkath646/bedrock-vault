import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let nativePrompt: {
    promptPassword: () => Promise<Buffer>
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

export default async function askPassword(): Promise<Buffer | null> {
    const prompt = getNativePrompt();
    if (!prompt) {
        throw new Error("Native module not available for prompting password.");
    }
    try {
        const buffer = await prompt.promptPassword()
        return buffer
    } catch (error) {
        console.log(error)
        if (error instanceof Error && error.message === 'USER_CANCELLED') {
            return null
        }
        throw error
    }
}