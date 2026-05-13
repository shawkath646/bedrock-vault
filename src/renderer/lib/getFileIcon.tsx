import {
    File,
    FileArchive,
    FileAudio2,
    FileCode2,
    FileCog,
    FileImage,
    FileJson,
    FileLock2,
    FileSpreadsheet,
    FileSymlink,
    FileTerminal,
    FileText,
    FileVideo,
    Folder,
} from 'lucide-react';

interface Props {
    ext: string;
}

export default function GetFileIcon({ ext }: Props) {

    const normalizedExt = ext.toLowerCase();

    const baseClass = 'w-5 h-5 shrink-0';

    // folder
    if (normalizedExt === 'dir') {
        return (
            <Folder
                className={`${baseClass} text-amber-500`}
            />
        );
    }

    // images
    if (
        [
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.svg',
            '.bmp',
            '.ico',
            '.tiff',
            '.avif',
            '.heic'
        ].includes(normalizedExt)
    ) {
        return (
            <FileImage
                className={`${baseClass} text-sky-500`}
            />
        );
    }

    // audio
    if (
        [
            '.mp3',
            '.wav',
            '.ogg',
            '.flac',
            '.m4a',
            '.aac',
            '.wma',
            '.opus'
        ].includes(normalizedExt)
    ) {
        return (
            <FileAudio2
                className={`${baseClass} text-purple-500`}
            />
        );
    }

    // video
    if (
        [
            '.mp4',
            '.mkv',
            '.avi',
            '.mov',
            '.wmv',
            '.webm',
            '.flv',
            '.m4v',
            '.3gp'
        ].includes(normalizedExt)
    ) {
        return (
            <FileVideo
                className={`${baseClass} text-rose-500`}
            />
        );
    }

    // archives
    if (
        [
            '.zip',
            '.rar',
            '.7z',
            '.tar',
            '.gz',
            '.xz',
            '.bz2',
            '.iso'
        ].includes(normalizedExt)
    ) {
        return (
            <FileArchive
                className={`${baseClass} text-orange-500`}
            />
        );
    }

    // spreadsheets
    if (
        [
            '.xlsx',
            '.xls',
            '.csv',
            '.ods'
        ].includes(normalizedExt)
    ) {
        return (
            <FileSpreadsheet
                className={`${baseClass} text-emerald-500`}
            />
        );
    }

    // documents
    if (
        [
            '.doc',
            '.docx',
            '.odt',
            '.rtf',
            '.txt',
            '.md'
        ].includes(normalizedExt)
    ) {
        return (
            <FileText
                className={`${baseClass} text-blue-500`}
            />
        );
    }

    // pdf
    if (normalizedExt === '.pdf') {
        return (
            <FileText
                className={`${baseClass} text-red-500`}
            />
        );
    }

    // json
    if (
        [
            '.json',
            '.jsonc'
        ].includes(normalizedExt)
    ) {
        return (
            <FileJson
                className={`${baseClass} text-yellow-500`}
            />
        );
    }

    // code
    if (
        [
            '.ts',
            '.tsx',
            '.js',
            '.jsx',
            '.mjs',
            '.cjs',
            '.py',
            '.go',
            '.java',
            '.kt',
            '.cpp',
            '.c',
            '.h',
            '.hpp',
            '.cs',
            '.rs',
            '.php',
            '.rb',
            '.swift',
            '.scala',
            '.lua',
            '.dart',
            '.sql',
            '.html',
            '.css',
            '.scss',
            '.sass',
            '.less',
            '.xml',
            '.yaml',
            '.yml'
        ].includes(normalizedExt)
    ) {
        return (
            <FileCode2
                className={`${baseClass} text-indigo-500`}
            />
        );
    }

    // shell / terminal
    if (
        [
            '.sh',
            '.bash',
            '.zsh',
            '.fish',
            '.ps1',
            '.bat',
            '.cmd'
        ].includes(normalizedExt)
    ) {
        return (
            <FileTerminal
                className={`${baseClass} text-zinc-500`}
            />
        );
    }

    // encrypted / key files
    if (
        [
            '.enc',
            '.key',
            '.pem',
            '.crt',
            '.p12',
            '.pfx',
            '.asc',
            '.gpg'
        ].includes(normalizedExt)
    ) {
        return (
            <FileLock2
                className={`${baseClass} text-cyan-500`}
            />
        );
    }

    // executables
    if (
        [
            '.exe',
            '.msi',
            '.apk',
            '.appimage',
            '.deb',
            '.rpm'
        ].includes(normalizedExt)
    ) {
        return (
            <FileCog
                className={`${baseClass} text-neutral-500`}
            />
        );
    }

    // shortcuts / links
    if (
        [
            '.lnk',
            '.url',
            '.desktop'
        ].includes(normalizedExt)
    ) {
        return (
            <FileSymlink
                className={`${baseClass} text-violet-500`}
            />
        );
    }

    // fallback
    return (
        <File
            className={`${baseClass} text-primary`}
        />
    );
}