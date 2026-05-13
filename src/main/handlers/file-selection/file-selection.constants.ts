export const FILE_TYPE_EXTENSION_MAP = {
    documents: new Set(['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.csv', '.rtf']),
    audio: new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']),
    video: new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv']),
    pictures: new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']),
    programs: new Set(['.exe', '.msi', '.app', '.sh', '.bat', '.dmg', '.pkg']),
} as const;

export const ALL_KNOWN_FILE_EXTENSIONS = new Set(
    Object.values(FILE_TYPE_EXTENSION_MAP).flatMap((extensionSet) => [...extensionSet]),
);