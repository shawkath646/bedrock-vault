import crypto from 'node:crypto';
import type { FileKeyEntry } from '@shared/types/file-encryption';
import { ENC_ALGORITHM, MAGIC_BYTES } from '@main/constant/crypto.constants';

export interface MetadataHandler {
  chunkName?: string;
  fileMetadata: FileKeyEntry[];
}

export interface EncryptedDataRaw {
  iv: Buffer;
  authTag: Buffer;
  encryptedData: Buffer;
}

export interface ParsedHeader {
  magic: string;
  encryptionLevel: number;
  timestamp: string;
  chunkName: string;
  cryptoPayloadOffset: number;
}

export function buildMetadataPayload(
  level: number,
  chunkName: string,
  timestampMs: number,
  salt: Buffer,
  passWrap: EncryptedDataRaw,
  backupWrap: EncryptedDataRaw,
  metadataEnc: EncryptedDataRaw
): Buffer {
  let magic: string;
  if (level === 1) magic = MAGIC_BYTES.LEVEL1;
  else if (level === 2) magic = MAGIC_BYTES.LEVEL2;
  else if (level === 3) magic = MAGIC_BYTES.LEVEL3;
  else throw new Error(`Invalid encryption level: ${level}`);

  const magicBytes = Buffer.from(magic, 'utf8'); // 4 bytes
  
  const levelByte = Buffer.alloc(1);
  levelByte.writeUInt8(level, 0); // 1 byte

  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(timestampMs), 0); // 8 bytes

  const chunkNameBuf = Buffer.from(chunkName, 'utf8');
  const chunkNameLenBuf = Buffer.alloc(4);
  chunkNameLenBuf.writeUInt32BE(chunkNameBuf.length, 0); // 4 bytes

  return Buffer.concat([
    magicBytes,
    levelByte,
    timeBuf,
    chunkNameLenBuf,
    chunkNameBuf,
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
}

export function parseMetadataHeader(buffer: Buffer): ParsedHeader {
  if (buffer.length < 17) {
    throw new Error('INVALID_METADATA_HEADER');
  }

  let offset = 0;
  const magic = buffer.toString('utf8', offset, offset + 4);
  offset += 4;

  if (magic !== MAGIC_BYTES.LEVEL1 && magic !== MAGIC_BYTES.LEVEL2 && magic !== MAGIC_BYTES.LEVEL3) {
    throw new Error('INVALID_METADATA_HEADER');
  }

  const encryptionLevel = buffer.readUInt8(offset);
  offset += 1;

  const timestampMs = Number(buffer.readBigInt64BE(offset));
  offset += 8;

  const chunkNameLen = buffer.readUInt32BE(offset);
  offset += 4;

  if (offset + chunkNameLen > buffer.length) {
    throw new Error('CORRUPTED_METADATA');
  }
  const chunkName = buffer.toString('utf8', offset, offset + chunkNameLen);
  offset += chunkNameLen;

  return {
    magic,
    encryptionLevel,
    timestamp: new Date(timestampMs).toISOString(),
    chunkName,
    cryptoPayloadOffset: offset
  };
}

/**
 * Binary serialization protocol for metadata to avoid converting raw keys into V8 string objects
 * which linger permanently in memory.
 */
export function serializeMetadata(metadata: MetadataHandler): Buffer {
  const buffers: Buffer[] = [];
  
  const writeString = (str: string) => {
    const strBuf = Buffer.from(str, 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(strBuf.length, 0);
    buffers.push(lenBuf, strBuf);
  };

  // 1. Write count of fileMetadata entries
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32BE(metadata.fileMetadata.length, 0);
  buffers.push(countBuf);

  // 2. Write each file entry
  for (const entry of metadata.fileMetadata) {
    writeString(entry.name);
    writeString(entry.encName);
    writeString(entry.virtualPath);
    
    // Write key (32 bytes)
    const keyCopy = Buffer.alloc(32);
    entry.key.copy(keyCopy);
    buffers.push(keyCopy);
    
    // Write iv (12 bytes)
    const ivCopy = Buffer.alloc(12);
    entry.iv.copy(ivCopy);
    buffers.push(ivCopy);
    
    writeString(entry.enc_algorithm);
    
    // Write size (8 bytes BigInt)
    const sizeBuf = Buffer.alloc(8);
    sizeBuf.writeBigInt64BE(BigInt(entry.size), 0);
    buffers.push(sizeBuf);
    
    writeString(entry.ext);
  }

  const result = Buffer.concat(buffers);
  
  // Zero out intermediate buffers to prevent keys/IVs from lingering in heap
  for (const buf of buffers) {
    buf.fill(0);
  }

  return result;
}

/**
 * Matching binary deserialization protocol for complete structural integrity and future decryption support.
 */
export function deserializeMetadata(buffer: Buffer): MetadataHandler {
  let offset = 0;

  const readString = (): string => {
    if (offset + 4 > buffer.length) throw new Error("Malformed metadata: string length out of bounds");
    const len = buffer.readUInt32BE(offset);
    offset += 4;
    if (offset + len > buffer.length) throw new Error("Malformed metadata: string content out of bounds");
    const str = buffer.toString('utf8', offset, offset + len);
    offset += len;
    return str;
  };

  if (offset + 4 > buffer.length) throw new Error("Malformed metadata: count out of bounds");
  const count = buffer.readUInt32BE(offset);
  offset += 4;

  const fileMetadata: FileKeyEntry[] = [];

  for (let i = 0; i < count; i++) {
    const name = readString();
    const encName = readString();
    const virtualPath = readString();

    if (offset + 32 > buffer.length) throw new Error("Malformed metadata: key out of bounds");
    const key = Buffer.alloc(32);
    buffer.copy(key, 0, offset, offset + 32);
    offset += 32;

    if (offset + 12 > buffer.length) throw new Error("Malformed metadata: iv out of bounds");
    const iv = Buffer.alloc(12);
    buffer.copy(iv, 0, offset, offset + 12);
    offset += 12;

    const enc_algorithm = readString();

    if (offset + 8 > buffer.length) throw new Error("Malformed metadata: size out of bounds");
    const size = Number(buffer.readBigInt64BE(offset));
    offset += 8;

    const ext = readString();

    fileMetadata.push({
      name,
      encName,
      virtualPath,
      key,
      iv,
      enc_algorithm,
      size,
      ext,
    });
  }

  return { fileMetadata };
}

/**
 * Helper function returning pure Buffers instead of Base64 strings.
 */
export function encryptDataRaw(data: Buffer, key: Buffer): EncryptedDataRaw {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGORITHM, key, iv);

  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { iv, authTag, encryptedData };
}

/**
 * Core raw decryption primitive.
 */
export function decryptDataRaw(encrypted: EncryptedDataRaw, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ENC_ALGORITHM, key, encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);
  return Buffer.concat([decipher.update(encrypted.encryptedData), decipher.final()]);
}
