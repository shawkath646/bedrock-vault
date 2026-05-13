import appMetadata from "@shared/constant/metadata.json";

export default function Footer() {
    return (
        <footer className="flex shrink-0 items-center justify-end gap-2 bg-background/70 px-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground">An open source software by</p>
            <img 
                src={appMetadata.publishedBy.icon} 
                height={15} 
                width={50}
                alt={appMetadata.publishedBy.name}
            />
        </footer>
    );
}