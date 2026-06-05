export const INLINE_THRESHOLD_BYTES = 512 * 1024; // 512 KB inline buffer boundary
export const THROTTLE_INTERVAL_MS = 150; // Smooth emitter update speed

export const SYSTEM_PATH_PATTERNS = [
  /^\/(etc|var|usr|bin|sbin|dev|proc|sys|root|home\/[^/]+(?:\/\.[^/]+)*)$/,
  /^[c-z]:\\(windows|winnt|program files|programdata|users\\[^\\]+\\appdata)/
] as const;

export const DEFAULT_RECOVERY_PHRASE_FILENAME = 'recovery_phrase.txt';
export const DEFAULT_KEY_FILENAME = 'key_file';
export const PREFERENCES_FILENAME = 'encryption_preferences.json';
export const RECORD_FILENAME = 'record.json';
