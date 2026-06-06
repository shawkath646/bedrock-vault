import crypto from 'node:crypto';
import WORDLIST from "@main/constant/word-list.json";

/**
 * Generates a highly secure 12-word Recovery Phrase from cryptographically secure random selections.
 * 12 words * 11 bits = 132 bits of entropy (2^132 combinations).
 */
export function generateMnemonic(): string {
    const words: string[] = [];
    
    for (let i = 0; i < 12; i++) {
        const index = crypto.randomInt(0, WORDLIST.length);
        words.push(WORDLIST[index]);
    }
    
    return words.join(' ');
}

export function mnemonicToKey(mnemonic: string, salt: Buffer | string = 'bedrock-vault-salt-recovery'): Buffer {
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.pbkdf2Sync(normalized, salt, 100000, 32, 'sha256');
}
