import { app, BrowserWindow } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nativePrompt = require('./src/main/native/native_prompt.node');

const ENC_ALGORITHM = 'aes-256-gcm';
const CRYPTO_SIZES = {
  MAGIC: 4,
  SALT: 16,
  IV: 12,
  AUTH_TAG: 16,
  KEY: 32,
  TPM_ENC_DATA: 256,
  PASS_ENC_DATA: 32,
};

function decryptDataRaw(encrypted, key) {
  const decipher = crypto.createDecipheriv(ENC_ALGORITHM, key, encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);
  return Buffer.concat([decipher.update(encrypted.encryptedData), decipher.final()]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  const nativeHandle = win.getNativeWindowHandle();

  const metadataPath = "C:\\Users\\shawk\\OneDrive\\Desktop\\test4\\v";
  
  try {
    const buf = await fs.readFile(metadataPath);
    console.log("Read metadata file size:", buf.length);

    console.log("Prompting for password in Electron (please enter the correct password for test4)...");
    const pwdBuffer = await nativePrompt.promptPassword(nativeHandle);
    
    if (!pwdBuffer || pwdBuffer.length === 0) {
      console.log("No password entered.");
      app.quit();
      return;
    }

    const salt = buf.subarray(4, 20);
    console.log("Salt:", salt.toString('hex'));

    const passwordKey = crypto.scryptSync(pwdBuffer, salt, 32);
    console.log("Derived Password Key (hex first 8 bytes):", passwordKey.subarray(0, 8).toString('hex'));

    const startWrap = 20;
    const passWrap = {
      iv: buf.subarray(startWrap, startWrap + CRYPTO_SIZES.IV),
      authTag: buf.subarray(startWrap + CRYPTO_SIZES.IV, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
      encryptedData: buf.subarray(startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG, startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.TPM_ENC_DATA)
    };

    const tpmWrappedDek = decryptDataRaw(passWrap, passwordKey);
    console.log("SUCCESS decrypting passWrap! Size of tpmWrappedDek:", tpmWrappedDek.length);
    
    console.log("Decrypting via TPM/KSP...");
    const dek = await nativePrompt.tpmDecrypt(tpmWrappedDek);
    console.log("SUCCESS decrypting via TPM! Size of DEK:", dek.length);
    
    const startBackup = startWrap + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.TPM_ENC_DATA;
    const startMetadataEnc = startBackup + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG + CRYPTO_SIZES.PASS_ENC_DATA;

    const metadataEnc = {
      iv: buf.subarray(startMetadataEnc, startMetadataEnc + CRYPTO_SIZES.IV),
      authTag: buf.subarray(startMetadataEnc + CRYPTO_SIZES.IV, startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG),
      encryptedData: buf.subarray(startMetadataEnc + CRYPTO_SIZES.IV + CRYPTO_SIZES.AUTH_TAG)
    };

    const decryptedMetadata = decryptDataRaw(metadataEnc, dek);
    console.log("SUCCESS decrypting final metadata! Size:", decryptedMetadata.length);

  } catch (err) {
    console.error("ERROR during Electron decryption run:", err);
  } finally {
    app.quit();
  }
});
