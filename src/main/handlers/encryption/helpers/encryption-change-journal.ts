import fs from 'fs/promises';

export default class EncryptionChangeJournal {
    private readonly created: string[] = [];

    recordCreated(filePath: string): void {
        this.created.push(filePath);
    }

    async rollback(): Promise<void> {
        await Promise.allSettled(this.created.map(p => fs.rm(p, { force: true })));
        this.created.length = 0;
    }
}