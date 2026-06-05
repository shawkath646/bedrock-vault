import crypto from 'node:crypto';
import type { FileKeyEntry } from '@shared/types/fileEncryption';
import { isTpmAvailable, isSoftwareKspAvailable, tpmDecrypt } from '@main/utils/native-crypto';
import logger from '@main/utils/logger';
import {
  decryptDataRaw,
  deserializeMetadata,
  type EncryptedDataRaw
} from '@main/handlers/crypto-core.helpers';
import { MetadataSchema } from '../decryption-schemas';
import { MAGIC_BYTES, CRYPTO_SIZES } from '@main/constant/crypto.constants';

interface DecryptedPayloadResult {
  level: number;
  chunkName: string;
  fileMetadata: FileKeyEntry[];
}

export async function decryptMetadataPayload(
  metadataBuffer: Buffer,
  passwordBuffer: Buffer
): Promise<DecryptedPayloadResult> {
  if (metadataBuffer.length < CRYPTO_SIZES.MAGIC) {
    throw new Error('INVALID_METADATA_HEADER');
  }

  // Check magic bytes
  const magic = metadataBuffer.toString('utf8', 0, CRYPTO_SIZES.MAGIC);
  let level: number;
  if (magic === MAGIC_BYTES.LEVEL1) {
    level = 1;
  } else if (magic === MAGIC_BYTES.LEVEL2) {
    level = 2;
  } else if (magic === MAGIC_BYTES.LEVEL3) {
    level = 3;
  } else {
    throw new Error('INVALID_METADATA_HEADER');
  }

  // Validate TPM availability for Levels 2 & 3
  if ((level === 2 || level === 3) && !isTpmAvailable() && !isSoftwareKspAvailable()) {
    const errorWithLevel = new Error('TPM_UNAVAILABLE') as Error & { level?: number };
    errorWithLevel.level = level;
    throw errorWithLevel;
  }

  // Extract fields
  const salt = metadataBuffer.subarray(
    CRYPTO_SIZES.MAGIC,
    CRYPTO_SIZES.MAGIC + CRYPTO_SIZES.SALT
  );
  const passwordKey = crypto.scryptSync(passwordBuffer, salt, CRYPTO_SIZES.KEY);

  let passWrap: EncryptedDataRaw;
  let metadataEnc: EncryptedDataRaw;
  const startWrap = CRYPTO_SIZES.MAGIC + CRYPTO_SIZES.SALT;

  let dek: Buffer | null = null;
  let tpmWrappedDek: Buffer | null = null;
  let decryptedMetadata: Buffer | null = null;

  try {
    if (level === 1) {
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
      if (level === 1) {
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
      level,
      chunkName: validated.chunkName,
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
