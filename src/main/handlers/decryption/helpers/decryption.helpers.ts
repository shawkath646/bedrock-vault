import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { FileKeyEntry } from '@shared/types/file-encryption';
import { isTpmAvailable, isSoftwareKspAvailable, tpmDecrypt } from '@main/utils/native-crypto';
import logger from '@main/utils/logger';
import {
  decryptDataRaw,
  deserializeMetadata,
  parseMetadataHeader,
  type EncryptedDataRaw
} from '@main/handlers/crypto-core.helpers';
import { MetadataSchema } from '../decryption-schemas';
import { CRYPTO_SIZES } from '@main/constant/crypto.constants';
import { VALID_ENCRYPTION_LEVELS } from '@shared/constant/encryption-options.constants';
import type { EncryptionLevel } from '@shared/types/global';

interface DecryptedPayloadResult {
  level: EncryptionLevel;
  chunkName: string;
  fileMetadata: FileKeyEntry[];
}

export async function decryptMetadataPayload(
  metadataBuffer: Buffer,
  passwordBuffer: Buffer
): Promise<DecryptedPayloadResult> {
  const header = parseMetadataHeader(metadataBuffer);
  
  // FIX: Check if the level is NOT in our valid array
  if (!VALID_ENCRYPTION_LEVELS.includes(header.encryptionLevel as EncryptionLevel)) {
    const errorWithLevel = new Error('INVALID_LEVEL') as Error & { level?: number };
    errorWithLevel.level = header.encryptionLevel;
    throw errorWithLevel;
  }

  // Validate TPM availability for Levels 2 & 3
  if ((header.encryptionLevel === 2 || header.encryptionLevel === 3) && !isTpmAvailable() && !isSoftwareKspAvailable()) {
    const errorWithLevel = new Error('TPM_UNAVAILABLE') as Error & { level?: number };
    errorWithLevel.level = header.encryptionLevel;
    throw errorWithLevel;
  }

  const startCrypto = header.cryptoPayloadOffset;

  // Extract fields starting from crypto payload offset
  const salt = metadataBuffer.subarray(
    startCrypto,
    startCrypto + CRYPTO_SIZES.SALT
  );
  
  // Note: Since this is decryption, you might also want to wrap this in scryptAsync 
  // like we did in the encryption flow to prevent blocking the UI!
  const scryptAsync = promisify(crypto.scrypt);
  const passwordKey = (await scryptAsync(passwordBuffer, salt, CRYPTO_SIZES.KEY)) as Buffer;

  let passWrap: EncryptedDataRaw;
  let metadataEnc: EncryptedDataRaw;
  const startWrap = startCrypto + CRYPTO_SIZES.SALT;

  let dek: Buffer | null = null;
  let tpmWrappedDek: Buffer | null = null;
  let decryptedMetadata: Buffer | null = null;

  try {
    if (header.encryptionLevel === 1) {
      const minLength = startWrap + 2 * (CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA) + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG;
      if (metadataBuffer.length < minLength) {
        throw new Error('CORRUPTED_METADATA');
      }

      passWrap = {
        iv: metadataBuffer.subarray(startWrap, startWrap + CRYPTO_SIZES.IV),
        authTag: metadataBuffer.subarray(startWrap + CRYPTO_SIZES.IV, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
        encryptedData: metadataBuffer.subarray(startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA)
      };

      const startBackup = startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA;
      const startMetadataEnc = startBackup + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA;

      metadataEnc = {
        iv: metadataBuffer.subarray(startMetadataEnc, startMetadataEnc + CRYPTO_SIZES.IV),
        authTag: metadataBuffer.subarray(startMetadataEnc + CRYPTO_SIZES.IV, startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
        encryptedData: metadataBuffer.subarray(startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG)
      };
    } else {
      // Level 2 or 3
      const minLength = startWrap +
        (CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.TPM_ENC_DATA) +
        (CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA) +
        CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG;
      if (metadataBuffer.length < minLength) {
        throw new Error('CORRUPTED_METADATA');
      }

      passWrap = {
        iv: metadataBuffer.subarray(startWrap, startWrap + CRYPTO_SIZES.IV),
        authTag: metadataBuffer.subarray(startWrap + CRYPTO_SIZES.IV, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
        encryptedData: metadataBuffer.subarray(startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.TPM_ENC_DATA)
      };

      const startBackup = startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.TPM_ENC_DATA;
      const startMetadataEnc = startBackup + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA;

      metadataEnc = {
        iv: metadataBuffer.subarray(startMetadataEnc, startMetadataEnc + CRYPTO_SIZES.IV),
        authTag: metadataBuffer.subarray(startMetadataEnc + CRYPTO_SIZES.IV, startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
        encryptedData: metadataBuffer.subarray(startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG)
      };
    }

    // Decrypt DEK
    try {
      if (header.encryptionLevel === 1) {
        dek = decryptDataRaw(passWrap, passwordKey);
      } else {
        tpmWrappedDek = decryptDataRaw(passWrap, passwordKey);
        dek = await tpmDecrypt(tpmWrappedDek);
      }
    } catch (err) {
      await logger.warn('DecryptionHelper', `Decryption of DEK failed: ${err}`);
      throw new Error('INVALID_PASSWORD', { cause: err });
    }

    if (!dek || dek.length !== CRYPTO_SIZES.KEY) {
      throw new Error('INVALID_PASSWORD');
    }

    // Decrypt Metadata
    try {
      decryptedMetadata = decryptDataRaw(metadataEnc, dek);
    } catch (err) {
      await logger.warn('DecryptionHelper', `Decryption of Metadata failed: ${err}`);
      throw new Error('METADATA_DECRYPTION_FAILED', { cause: err });
    }

    // Deserialize & Validate
    const deserialized = deserializeMetadata(decryptedMetadata);
    const validated = MetadataSchema.parse(deserialized);

    return {
      level: header.encryptionLevel as EncryptionLevel,
      chunkName: header.chunkName,
      fileMetadata: validated.fileMetadata
    };
  } finally {
    // Zero sensitive memory buffers
    passwordKey.fill(0);
    if (tpmWrappedDek) tpmWrappedDek.fill(0);
    if (dek) dek.fill(0);
    if (decryptedMetadata) decryptedMetadata.fill(0);
  }
}