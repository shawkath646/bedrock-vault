import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

// Native Wrappers & Diagnostics
import { tpmEncrypt } from '@main/utils/native-crypto';
import { generateMnemonic, mnemonicToKey } from '@main/utils/mnemonic';
import logger from '@main/utils/logger';

// Shared Crypto Core Helpers
import {
  serializeMetadata,
  encryptDataRaw,
  type MetadataHandler,
  type EncryptedDataRaw
} from '@main/handlers/crypto-core.helpers';

// Constants
import { MAGIC_BYTES, KEYFILE_HEADER } from '@main/constant/crypto.constants';

const scryptAsync = promisify(crypto.scrypt);

export interface OutputPath {
  recoveryPhrasePath: string;
  keyFilePath?: string;
  metadataPath: string;
}

export async function level1Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath): Promise<void> {
  const parsedMetadata = serializeMetadata(props);
  const dek = crypto.randomBytes(32);
  const salt = crypto.randomBytes(16);
  
  const passwordKey = (await scryptAsync(password, salt, 32)) as Buffer;

  const recoveryPhrase = generateMnemonic();
  const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

  let passWrap: EncryptedDataRaw | null = null;
  let backupWrap: EncryptedDataRaw | null = null;
  let metadataEnc: EncryptedDataRaw | null = null;

  try {
    metadataEnc = encryptDataRaw(parsedMetadata, dek);
    passWrap = encryptDataRaw(dek, passwordKey);
    backupWrap = encryptDataRaw(dek, recoveryPhraseKey);

    const magicBytes = Buffer.from(MAGIC_BYTES.LEVEL1, "utf8");

    const finalBinaryPayload = Buffer.concat([
      magicBytes,
      salt,
      passWrap.iv,
      passWrap.authTag,
      passWrap.encryptedData,
      backupWrap.iv,
      backupWrap.authTag,
      backupWrap.encryptedData,
      metadataEnc.iv,
      metadataEnc.authTag,
      metadataEnc.encryptedData
    ]);

    await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
    await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

    const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
      `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
      `Mnemonic Phrase:\n${recoveryPhrase}\n`;

    await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
    await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

    await logger.info("KeyManagement", `Level 1 encryption completed. Metadata size: ${finalBinaryPayload.length} bytes.`);
  } finally {
    parsedMetadata.fill(0);
    dek.fill(0);
    passwordKey.fill(0);
    recoveryPhraseKey.fill(0);
    if (passWrap) {
      passWrap.iv.fill(0);
      passWrap.authTag.fill(0);
      passWrap.encryptedData.fill(0);
    }
    if (backupWrap) {
      backupWrap.iv.fill(0);
      backupWrap.authTag.fill(0);
      backupWrap.encryptedData.fill(0);
    }
    if (metadataEnc) {
      metadataEnc.iv.fill(0);
      metadataEnc.authTag.fill(0);
      metadataEnc.encryptedData.fill(0);
    }
  }
}

export async function level2Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath): Promise<void> {
  const parsedMetadata = serializeMetadata(props);
  const dek = crypto.randomBytes(32);
  const salt = crypto.randomBytes(16);
  
  const passwordKey = (await scryptAsync(password, salt, 32)) as Buffer;

  const recoveryPhrase = generateMnemonic();
  const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

  let tpmWrappedDek: Buffer | null = null;
  let passWrap: EncryptedDataRaw | null = null;
  let backupWrap: EncryptedDataRaw | null = null;
  let metadataEnc: EncryptedDataRaw | null = null;

  try {
    metadataEnc = encryptDataRaw(parsedMetadata, dek);
    tpmWrappedDek = await tpmEncrypt(dek);
    passWrap = encryptDataRaw(tpmWrappedDek!, passwordKey);
    backupWrap = encryptDataRaw(dek, recoveryPhraseKey);

    const magicBytes = Buffer.from(MAGIC_BYTES.LEVEL2, "utf8");

    const finalBinaryPayload = Buffer.concat([
      magicBytes,
      salt,
      passWrap.iv,
      passWrap.authTag,
      passWrap.encryptedData,
      backupWrap.iv,
      backupWrap.authTag,
      backupWrap.encryptedData,
      metadataEnc.iv,
      metadataEnc.authTag,
      metadataEnc.encryptedData
    ]);

    await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
    await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

    const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
      `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
      `Mnemonic Phrase:\n${recoveryPhrase}\n`;

    await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
    await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

    await logger.info("KeyManagement", `Level 2 encryption completed with TPM. Metadata size: ${finalBinaryPayload.length} bytes.`);
  } finally {
    parsedMetadata.fill(0);
    dek.fill(0);
    passwordKey.fill(0);
    recoveryPhraseKey.fill(0);
    if (tpmWrappedDek) tpmWrappedDek.fill(0);
    if (passWrap) {
      passWrap.iv.fill(0);
      passWrap.authTag.fill(0);
      passWrap.encryptedData.fill(0);
    }
    if (backupWrap) {
      backupWrap.iv.fill(0);
      backupWrap.authTag.fill(0);
      backupWrap.encryptedData.fill(0);
    }
    if (metadataEnc) {
      metadataEnc.iv.fill(0);
      metadataEnc.authTag.fill(0);
      metadataEnc.encryptedData.fill(0);
    }
  }
}

export async function level3Enc(props: MetadataHandler, password: Buffer, outputPath: OutputPath): Promise<void> {
  const parsedMetadata = serializeMetadata(props);
  const dek = crypto.randomBytes(32);
  const salt = crypto.randomBytes(16);
  
  const passwordKey = (await scryptAsync(password, salt, 32)) as Buffer;

  const recoveryPhrase = generateMnemonic();
  const recoveryPhraseKey = mnemonicToKey(recoveryPhrase);

  let tpmWrappedDek: Buffer | null = null;
  let passWrap: EncryptedDataRaw | null = null;
  let backupWrap: EncryptedDataRaw | null = null;
  let metadataEnc: EncryptedDataRaw | null = null;
  let keyFilePayload: Buffer | null = null;
  let keyFileContent: Buffer | null = null;
  let combinedKey: Buffer | null = null;

  try {
    metadataEnc = encryptDataRaw(parsedMetadata, dek);
    tpmWrappedDek = await tpmEncrypt(dek);
    passWrap = encryptDataRaw(tpmWrappedDek!, passwordKey);

    const keyFileHeader = Buffer.from(KEYFILE_HEADER, "utf8");
    keyFilePayload = crypto.randomBytes(64);
    keyFileContent = Buffer.concat([keyFileHeader, keyFilePayload]);

    combinedKey = crypto.createHmac("sha256", recoveryPhraseKey)
      .update(keyFilePayload)
      .digest();

    backupWrap = encryptDataRaw(dek, combinedKey);

    const magicBytes = Buffer.from(MAGIC_BYTES.LEVEL3, "utf8");

    const finalBinaryPayload = Buffer.concat([
      magicBytes,
      salt,
      passWrap.iv,
      passWrap.authTag,
      passWrap.encryptedData,
      backupWrap.iv,
      backupWrap.authTag,
      backupWrap.encryptedData,
      metadataEnc.iv,
      metadataEnc.authTag,
      metadataEnc.encryptedData
    ]);

    await fs.mkdir(path.dirname(outputPath.metadataPath), { recursive: true });
    await fs.writeFile(outputPath.metadataPath, finalBinaryPayload);

    const recoveryPhraseFileContent = `Bedrock Vault - Recovery Phrase\n\n` +
      `Keep this file highly secure and private. These 12 words allow you to recover your encrypted data if you lose your password.\n\n` +
      `Mnemonic Phrase:\n${recoveryPhrase}\n`;

    await fs.mkdir(path.dirname(outputPath.recoveryPhrasePath), { recursive: true });
    await fs.writeFile(outputPath.recoveryPhrasePath, recoveryPhraseFileContent, "utf8");

    const finalKeyFilePath = outputPath.keyFilePath ?? outputPath.recoveryPhrasePath;
    await fs.mkdir(path.dirname(finalKeyFilePath), { recursive: true });
    await fs.writeFile(finalKeyFilePath, keyFileContent);

    await logger.info("KeyManagement", `Level 3 encryption completed with TPM and Keyfile. Metadata size: ${finalBinaryPayload.length} bytes.`);
  } finally {
    parsedMetadata.fill(0);
    dek.fill(0);
    passwordKey.fill(0);
    recoveryPhraseKey.fill(0);
    if (tpmWrappedDek) tpmWrappedDek.fill(0);
    if (keyFilePayload) keyFilePayload.fill(0);
    if (keyFileContent) keyFileContent.fill(0);
    if (combinedKey) combinedKey.fill(0);
    if (passWrap) {
      passWrap.iv.fill(0);
      passWrap.authTag.fill(0);
      passWrap.encryptedData.fill(0);
    }
    if (backupWrap) {
      backupWrap.iv.fill(0);
      backupWrap.authTag.fill(0);
      backupWrap.encryptedData.fill(0);
    }
    if (metadataEnc) {
      metadataEnc.iv.fill(0);
      metadataEnc.authTag.fill(0);
      metadataEnc.encryptedData.fill(0);
    }
  }
}
