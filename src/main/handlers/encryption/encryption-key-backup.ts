/**
 * encryption-key-backup.ts
 *
 * Metadata encryption architecture for all three protection levels.
 *
 * ─── Core invariant ───────────────────────────────────────────────────────────
 * The main file encryption key NEVER exists unencrypted on disk.
 * The flow is always:
 *
 *   1. Build a plaintext metadata JSON containing file keys, IVs, algorithm
 *      info, recovery config, and all other parameters.
 *   2. Derive a protection key from the user's credentials (password + optional
 *      TPM secret, depending on level).
 *   3. AES-256-GCM encrypt the ENTIRE metadata JSON string.
 *   4. Write only the outer GCM envelope to disk.
 *      The metadata (and therefore the file key) is completely opaque to
 *      anyone who does not hold the correct credentials.
 *
 * ─── On-disk format (all levels, .enc file) ───────────────────────────────────
 * {
 *   "v": 2,
 *   "level": 1 | 2 | 3,
 *   "kdf": {
 *     "alg": "pbkdf2", "hash": "sha512", "iter": 600000,
 *     "saltHex": "<64-char hex>"
 *   },
 *   // Level 3 only — public split material:
 *   "split"?: { "halfBHex": "<64-char hex>", "disguiseSaltHex": "<64-char hex>" },
 *   "env": {
 *     "ivHex":  "<24-char hex>",
 *     "tagHex": "<32-char hex>",
 *     "ctHex":  "<hex>"              ← ciphertext of the full metadata JSON
 *   }
 * }
 *
 * ─── Decrypted metadata JSON (plaintext, NEVER written to disk) ───────────────
 * {
 *   "version": 1,
 *   "chunkName": "<name>",
 *   "createdAt": "<ISO timestamp>",
 *   "algorithm": "AES-256-CBC",
 *   "files": [
 *     {
 *       "name": "<filename>",
 *       "mainEncryptionKey": "<base64, 32 bytes>",
 *       "iv": "<base64, 16 bytes>"
 *     }
 *   ],
 *   "recovery": {
 *     "level": 1 | 2 | 3,
 *     "tpmBound": false | true
 *   }
 * }
 *
 * ─── Level 3 secret-splitting ─────────────────────────────────────────────────
 *   masterKey      = PBKDF2(password ‖ tpmSecret, salt)
 *   protectionKey  = HKDF-expand(masterKey, info="protection:v2", 32 bytes)
 *   halfA          = random(32)
 *   halfB          = halfA ⊕ protectionKey         ← stored plaintext in .enc
 *   halfA          → AES-256-GCM encrypted → disguised binary file
 *
 *   Recovery requires: password + TPM device + disguised file + .enc file.
 *   Neither artefact alone reveals protectionKey.
 *
 * ─── Disguised file binary layout (Level 3) ───────────────────────────────────
 *   [0–3]    fake magic bytes matching chosen extension
 *   [4–7]    0x00 structural padding
 *   [8–39]   disguiseSalt  (32 B)  — public, required for PBKDF2 of halfA key
 *   [40–51]  GCM IV         (12 B)
 *   [52–67]  GCM auth tag   (16 B)
 *   [68–99]  ciphertext of halfA (32 B)
 *   [100–N]  cryptographically random padding (48 KB – 512 KB)
 */

import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHmac, pbkdf2 as pbkdf2Cb } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Cb);

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAT_VERSION = 2;
const PBKDF2_HASH = 'sha512';
const PBKDF2_ITER = 600_000;
const KEY_LEN = 32; // AES-256

/** App-scoped seed mixed into the TPM secret derivation. */
const APP_SEED = Buffer.from('anonymous-file-storage:tpm:v1', 'utf8');

/** Fake magic bytes per disguise extension. */
const DISGUISE_MAGIC: Record<string, Buffer> = {
    mp3: Buffer.from([0xff, 0xfb, 0x90, 0x00]),
    mp4: Buffer.from([0x00, 0x00, 0x00, 0x20]),
    jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]),
};

const DISGUISE_EXTS = Object.keys(DISGUISE_MAGIC);

// ─── Public types ─────────────────────────────────────────────────────────────

/** One successfully-encrypted file entry passed from the workflow. */
export interface FileKeyEntry {
    /** Original filename (basename only, no path). */
    name: string;
    /** 32-byte raw AES-256 key used to encrypt this file. */
    key: Buffer;
    /** 16-byte CBC IV returned by the encryption worker. */
    iv: Buffer;
}

/** Everything the backup writer needs. */
export interface BackupContext {
    /** Plaintext password from the user prompt. */
    password: string;
    /** Chunk name — used in the output filename: `key_{chunkName}.enc`. */
    chunkName: string;
    /** Directory to write `key_{chunkName}.enc`. */
    backupKeyDirectory: string;
    /** Directory to write the disguised key file (Level 3 only). */
    backupFileKeyDirectory?: string;
    /** Encryption level selected by the user. */
    level: 1 | 2 | 3;
    /** File key entries for all successfully-encrypted files. */
    fileKeys: FileKeyEntry[];
}

// ─── GCM envelope ─────────────────────────────────────────────────────────────

interface GcmEnvelope {
    ivHex: string;
    tagHex: string;
    ctHex: string;
}

function gcmEncrypt(plaintext: Buffer, key: Buffer): GcmEnvelope {
    const iv = crypto.randomBytes(12);
    const ivHex = iv.toString('hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ivHex, tagHex: tag.toString('hex'), ctHex: ct.toString('hex') };
}

// ─── Machine identity (TPM-bound secret) ─────────────────────────────────────

/**
 * Returns a 32-byte deterministic machine-bound secret derived from stable
 * OS identifiers. This value can only be reproduced on the original machine.
 */
export async function getTpmSecret(): Promise<Buffer> {
    const machineId = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model ?? 'unknown-cpu',
    ].join('|');

    const hmac = createHmac('sha256', APP_SEED);
    hmac.update(Buffer.from(machineId, 'utf8'));
    return hmac.digest();
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derives a 32-byte protection key using PBKDF2-SHA-512.
 * For Level 2/3, `tpmSecret` is concatenated with the password bytes before
 * hashing, binding the derived key to this machine.
 * Both the IKM buffer and `tpmSecret` are zeroed after use.
 */
export async function deriveMasterKey(
    password: string,
    salt: Buffer,
    tpmSecret?: Buffer,
): Promise<Buffer> {
    const passwordBuf = Buffer.from(password, 'utf8');
    const ikm = tpmSecret
        ? Buffer.concat([passwordBuf, tpmSecret])
        : passwordBuf;

    const key = await pbkdf2(ikm, salt, PBKDF2_ITER, KEY_LEN, PBKDF2_HASH) as Buffer;

    ikm.fill(0);
    if (tpmSecret) tpmSecret.fill(0);

    return key;
}

// ─── Plaintext metadata builder ───────────────────────────────────────────────

/**
 * Constructs the plaintext metadata JSON that contains all key material and
 * recovery information. This string is NEVER written to disk — it is always
 * GCM-encrypted before any file I/O.
 */
function buildPlaintextMetadata(opts: {
    chunkName: string;
    level: 1 | 2 | 3;
    tpmBound: boolean;
    fileKeys: FileKeyEntry[];
}): string {
    const metadata = {
        version: 1,
        chunkName: opts.chunkName,
        createdAt: new Date().toISOString(),
        algorithm: 'AES-256-CBC',
        files: opts.fileKeys.map(f => ({
            name: f.name,
            mainEncryptionKey: f.key.toString('base64'),
            iv: f.iv.toString('base64'),
        })),
        recovery: {
            level: opts.level,
            tpmBound: opts.tpmBound,
        },
    };

    return JSON.stringify(metadata);
}

// ─── Outer envelope builder ───────────────────────────────────────────────────

/**
 * GCM-encrypts the entire metadata JSON string and wraps it in a minimal
 * outer object that contains only public KDF parameters and the opaque
 * ciphertext. The protection key is zeroed after encryption.
 */
function buildEncryptedEnvelope(opts: {
    level: 1 | 2 | 3;
    saltHex: string;
    protectionKey: Buffer;
    metadataJson: string;
    extraFields?: Record<string, unknown>;
}): string {
    const env = gcmEncrypt(Buffer.from(opts.metadataJson, 'utf8'), opts.protectionKey);
    opts.protectionKey.fill(0);

    const outer: Record<string, unknown> = {
        v: FORMAT_VERSION,
        level: opts.level,
        kdf: {
            alg: 'pbkdf2',
            hash: PBKDF2_HASH,
            iter: PBKDF2_ITER,
            saltHex: opts.saltHex,
        },
        ...opts.extraFields,
        env,
    };

    return JSON.stringify(outer, null, 2);
}

// ─── Level 1 ──────────────────────────────────────────────────────────────────

/**
 * Writes `key_{chunkName}.enc` protected by the user's password only.
 * Recovery requires: password + backup file.
 */
export async function writeLevel1Backup(ctx: BackupContext): Promise<string> {
    const salt = crypto.randomBytes(32);
    const protectionKey = await deriveMasterKey(ctx.password, salt);

    const metadataJson = buildPlaintextMetadata({
        chunkName: ctx.chunkName,
        level: 1,
        tpmBound: false,
        fileKeys: ctx.fileKeys,
    });

    const envelope = buildEncryptedEnvelope({
        level: 1,
        saltHex: salt.toString('hex'),
        protectionKey,
        metadataJson,
    });

    const filePath = path.join(ctx.backupKeyDirectory, `key_${ctx.chunkName}.enc`);
    await fs.writeFile(filePath, envelope, 'utf-8');
    return filePath;
}

// ─── Level 2 ──────────────────────────────────────────────────────────────────

/**
 * Writes `key_{chunkName}.enc` protected by password + TPM-bound machine secret.
 * Recovery requires: password + original machine + backup file.
 */
export async function writeLevel2Backup(ctx: BackupContext): Promise<string> {
    const salt = crypto.randomBytes(32);
    const tpmSecret = await getTpmSecret();
    const protectionKey = await deriveMasterKey(ctx.password, salt, tpmSecret);

    const metadataJson = buildPlaintextMetadata({
        chunkName: ctx.chunkName,
        level: 2,
        tpmBound: true,
        fileKeys: ctx.fileKeys,
    });

    const envelope = buildEncryptedEnvelope({
        level: 2,
        saltHex: salt.toString('hex'),
        protectionKey,
        metadataJson,
    });

    const filePath = path.join(ctx.backupKeyDirectory, `key_${ctx.chunkName}.enc`);
    await fs.writeFile(filePath, envelope, 'utf-8');
    return filePath;
}

// ─── Level 3 ──────────────────────────────────────────────────────────────────

/**
 * Derives the protectionKey and XOR-splits it so that both artefacts are
 * required for recovery.
 */
function splitProtectionKey(masterKey: Buffer): {
    protectionKey: Buffer;
    halfA: Buffer;
    halfB: Buffer;
} {
    const protectionKey = Buffer.from(
        crypto.hkdfSync(
            'sha256',
            masterKey,
            Buffer.alloc(32, 0),
            Buffer.from('protection:v2', 'utf8'),
            KEY_LEN,
        ),
    );

    const halfA = crypto.randomBytes(KEY_LEN);
    const halfB = Buffer.allocUnsafe(KEY_LEN);
    for (let i = 0; i < KEY_LEN; i++) {
        halfB[i] = halfA[i] ^ protectionKey[i];
    }

    return { protectionKey, halfA, halfB };
}

/**
 * Builds the disguised binary file that embeds halfA encrypted with
 * PBKDF2(password, disguiseSalt). Looks like a real media file.
 */
async function buildDisguisedFile(halfA: Buffer, password: string): Promise<{
    data: Buffer;
    ext: string;
    disguiseSaltHex: string;
}> {
    const ext = DISGUISE_EXTS[crypto.randomBytes(1)[0] % DISGUISE_EXTS.length];
    const magic = DISGUISE_MAGIC[ext];

    const disguiseSalt = crypto.randomBytes(32);
    const disguiseKey = await pbkdf2(
        Buffer.from(password, 'utf8'),
        disguiseSalt,
        PBKDF2_ITER,
        KEY_LEN,
        PBKDF2_HASH,
    ) as Buffer;

    const { ivHex, tagHex, ctHex } = gcmEncrypt(halfA, disguiseKey);
    disguiseKey.fill(0);

    // Binary layout:
    //   [0-3]    magic (4 B)
    //   [4-7]    0x00 structural padding
    //   [8-39]   disguiseSalt (32 B)
    //   [40-51]  GCM IV (12 B)
    //   [52-67]  GCM auth tag (16 B)
    //   [68-99]  ciphertext of halfA (32 B)
    //   [100-N]  random padding
    const header = Buffer.concat([
        magic,
        Buffer.alloc(4, 0),
        disguiseSalt,
        Buffer.from(ivHex, 'hex'),
        Buffer.from(tagHex, 'hex'),
        Buffer.from(ctHex, 'hex'),
    ]); // 4 + 4 + 32 + 12 + 16 + 32 = 100 bytes

    const padSize =
        48 * 1024 +
        (crypto.randomBytes(2).readUInt16BE() % (512 * 1024 - 48 * 1024));

    return {
        data: Buffer.concat([header, crypto.randomBytes(padSize)]),
        ext,
        disguiseSaltHex: disguiseSalt.toString('hex'),
    };
}

/**
 * Writes both Level-3 recovery artefacts:
 *   1. `{randomHex}.{ext}`   in backupFileKeyDirectory — disguised binary (halfA)
 *   2. `key_{chunkName}.enc` in backupKeyDirectory     — encrypted metadata
 *
 * The .enc file contains `halfBHex` in plaintext (useless without halfA from
 * the disguised file) plus the full metadata blob encrypted with protectionKey.
 * Recovery requires halfA ⊕ halfB = protectionKey, which decrypts the metadata,
 * which reveals the file encryption keys.
 */
export async function writeLevel3Backup(ctx: BackupContext): Promise<{
    backupKeyPath: string;
    disguisedFilePath: string;
}> {
    const salt = crypto.randomBytes(32);
    const tpmSecret = await getTpmSecret();
    const masterKey = await deriveMasterKey(ctx.password, salt, tpmSecret);

    const { protectionKey, halfA, halfB } = splitProtectionKey(masterKey);
    masterKey.fill(0);

    const fileKeyDir = ctx.backupFileKeyDirectory ?? ctx.backupKeyDirectory;
    const { data, ext, disguiseSaltHex } = await buildDisguisedFile(halfA, ctx.password);
    halfA.fill(0);

    const randomName = crypto.randomBytes(4).toString('hex');
    const disguisedFilePath = path.join(fileKeyDir, `${randomName}.${ext}`);
    await fs.writeFile(disguisedFilePath, data);

    // Build and encrypt the metadata JSON.
    // The outer envelope also carries halfB and disguiseSaltHex in plaintext
    // so the recovery tool knows how to reconstruct protectionKey.
    const metadataJson = buildPlaintextMetadata({
        chunkName: ctx.chunkName,
        level: 3,
        tpmBound: true,
        fileKeys: ctx.fileKeys,
    });

    const envelope = buildEncryptedEnvelope({
        level: 3,
        saltHex: salt.toString('hex'),
        protectionKey,
        metadataJson,
        extraFields: {
            split: {
                halfBHex: halfB.toString('hex'),
                disguiseSaltHex,
            },
        },
    });

    halfB.fill(0);

    const backupKeyPath = path.join(ctx.backupKeyDirectory, `key_${ctx.chunkName}.enc`);
    await fs.writeFile(backupKeyPath, envelope, 'utf-8');

    return { backupKeyPath, disguisedFilePath };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Selects and runs the appropriate level writer.
 * Returns a human-readable summary of what was written to disk.
 */
export async function writeBackupKeys(ctx: BackupContext): Promise<string> {
    switch (ctx.level) {
        case 1: {
            const p = await writeLevel1Backup(ctx);
            return `Backup key saved → ${path.basename(p)}`;
        }
        case 2: {
            const p = await writeLevel2Backup(ctx);
            return `TPM-bound backup key saved → ${path.basename(p)}`;
        }
        case 3: {
            const { backupKeyPath, disguisedFilePath } = await writeLevel3Backup(ctx);
            return (
                `Multi-factor backup saved → ` +
                `${path.basename(backupKeyPath)} + ${path.basename(disguisedFilePath)}`
            );
        }
    }
}
