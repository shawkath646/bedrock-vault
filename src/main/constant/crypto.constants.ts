export const ENC_ALGORITHM = 'aes-256-gcm';

export const MAGIC_BYTES = {
    LEVEL1: 'BEV1',
    LEVEL2: 'BVK2',
    LEVEL3: 'BVK3',
} as const;

export const KEYFILE_HEADER = 'BVK3_KEYFILE';

export const CRYPTO_SIZES = {
    MAGIC: 4,
    SALT: 16,
    IV: 12,
    AUTH_TAG: 16,
    KEY: 32,
    TPM_ENC_DATA: 256,
    PASS_ENC_DATA: 32,
} as const;
