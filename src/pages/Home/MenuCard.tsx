import {
    Lock,
    FolderKey,
    Settings
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Link } from 'react-router-dom';

interface MenuItem {
    id: string;
    icon: ComponentType<{ className?: string }>;
    title: string;
    description: string;
    path: string;
    iconBgColor: string;
    iconTextColor: string;
    hoverBgColor: string;
    hoverTextColor: string;
}

const menuItems: MenuItem[] = [
    {
        id: 'encrypt',
        icon: Lock,
        title: 'Encrypt Files',
        description: 'Secure new documents into your local vault.',
        path: '/file-selection',
        iconBgColor: 'bg-primary/10',
        iconTextColor: 'text-primary',
        hoverBgColor: 'group-hover:bg-primary',
        hoverTextColor: 'group-hover:text-primary-foreground',
    },
    {
        id: 'vault',
        icon: FolderKey,
        title: 'Open Vault',
        description: 'Access and manage your decrypted data.',
        path: '/vault',
        iconBgColor: 'bg-emerald-500/10',
        iconTextColor: 'text-emerald-600 dark:text-emerald-400',
        hoverBgColor: 'group-hover:bg-emerald-600',
        hoverTextColor: 'group-hover:text-white',
    },
    {
        id: 'settings',
        icon: Settings,
        title: 'Settings',
        description: 'Configure keys, paths, and preferences.',
        path: '/settings',
        iconBgColor: 'bg-muted',
        iconTextColor: 'text-muted-foreground',
        hoverBgColor: 'group-hover:bg-foreground',
        hoverTextColor: 'group-hover:text-background',
    }
];

export default function MenuCard() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                    <Link key={item.id} to={item.path}>
                        <Card className="group cursor-pointer border-border/70 bg-card/95 transition-all">
                            <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                                <div className={`rounded-xl ${item.iconBgColor} ${item.iconTextColor} p-3 transition-colors ${item.hoverBgColor} ${item.hoverTextColor}`}>
                                    <IconComponent className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="mb-1 text-lg font-semibold text-foreground">{item.title}</h3>
                                    <CardDescription>{item.description}</CardDescription>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}