import { askPassword } from '@main/utils/native-crypto';

let abortController: AbortController | null = null;
let inProgress = false;
let cachedPassword: Buffer | null = null;

export const setInProgress = (val: boolean): void => {
  inProgress = val;
};

export const isInProgress = (): boolean => {
  return inProgress;
};

export const setAbortController = (ac: AbortController | null): void => {
  abortController = ac;
};

export const getAbortController = (): AbortController | null => {
  return abortController;
};

export const abortEncryption = (): void => {
  if (inProgress) abortController?.abort('USER_ABORTED');
};

export async function setEncryptionPassword(): Promise<boolean> {
  const buffer = await askPassword();
  if (!buffer) return false;

  if (cachedPassword) {
    cachedPassword.fill(0);
  }

  cachedPassword = buffer;
  return true;
}

export function hasEncryptionPassword(): boolean {
  return cachedPassword !== null;
}

export function getCachedPassword(): Buffer | null {
  return cachedPassword;
}

export function clearCachedPassword(): void {
  if (cachedPassword) {
    cachedPassword.fill(0);
    cachedPassword = null;
  }
}
