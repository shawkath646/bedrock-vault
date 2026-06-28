import {
    Shield,
    Key,
    Share2,
    Lock,
    XCircle,
    RefreshCcw,
    Laptop,
    Database,
    AlertTriangle,
    Trash2,
    type LucideIcon
} from "lucide-react";

export interface SecurityGuideline {
    id: number;
    title: string;
    description: string;
    icon: LucideIcon;
}

export const SECURITY_GUIDELINES: SecurityGuideline[] = [
    {
        id: 1,
        title: "Ensure your system environment is trusted",
        description:
            "Avoid running unknown or untrusted applications, especially those with administrator or root privileges. Such applications may monitor memory or interfere with encryption processes.",
        icon: Shield
    },
    {
        id: 2,
        title: "Store your key securely",
        description:
            "Do not store your encryption key or password in plain text (e.g., notes, screenshots, or unsecured files). Other applications or users may access it.",
        icon: Key
    },
    {
        id: 3,
        title: "Do not share your key",
        description:
            "Never share your encryption key عبر email, messaging apps, or unencrypted channels. Anyone with access to the key can decrypt your data.",
        icon: Share2
    },
    {
        id: 4,
        title: "Use strong, unique passwords",
        description:
            "Choose a long, complex password that is not reused across other services to reduce the risk of brute-force attacks.",
        icon: Lock
    },
    {
        id: 5,
        title: "Close unnecessary applications",
        description:
            "Shut down apps that are not required before starting encryption or decryption to reduce interference and exposure risks.",
        icon: XCircle
    },
    {
        id: 6,
        title: "Keep your system up to date",
        description:
            "Always use the latest version of the application and your operating system to stay protected against known vulnerabilities.",
        icon: RefreshCcw
    },
    {
        id: 7,
        title: "Use trusted devices only",
        description:
            "Avoid using shared or public computers for encryption or decryption, as they may contain monitoring software.",
        icon: Laptop
    },
    {
        id: 8,
        title: "Handle backups carefully",
        description:
            "Store encrypted backups securely and never keep your encryption key alongside the encrypted data.",
        icon: Database
    },
    {
        id: 9,
        title: "Understand system limitations",
        description:
            "Encryption protects your data, but cannot fully secure it on a compromised system. Malware or attackers may still pose risks.",
        icon: AlertTriangle
    },
    {
        id: 10,
        title: "Clear sensitive data after use",
        description:
            "Avoid leaving sensitive information in memory, clipboard, or visible on screen after completing your task.",
        icon: Trash2
    }
];