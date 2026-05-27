import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const nativePrompt = require('../native/native_prompt.node') as {
    promptPassword: () => Promise<Buffer>
}

export default async function askPassword(): Promise<string | null> {
    try {
        const buffer = await nativePrompt.promptPassword()
        const password = buffer.toString('utf8')
        buffer.fill(0)
        return password
    } catch (error) {
        console.log(error)
        if (error instanceof Error && error.message === 'USER_CANCELLED') {
            return null
        }
        throw error
    }
}