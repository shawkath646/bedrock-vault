import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function NotFound() {
    const navigate = useNavigate();
    
    return (
        <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center space-y-8 max-w-md text-center animate-in fade-in duration-500">

                {/* Text Content */}
                <div className="space-y-3">
                    <h1 className="text-7xl font-extrabold tracking-tighter text-primary">404</h1>
                    <h2 className="text-2xl font-semibold tracking-tight">Page Not Found</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        The encrypted directory or vault page you are looking for does not exist, has been moved, or you lack the necessary clearance.
                    </p>
                </div>
                <Button
                    variant="outline"
                    className="w-full sm:w-auto py-2 px-5"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                </Button>
            </div>
        </div>
    );
}