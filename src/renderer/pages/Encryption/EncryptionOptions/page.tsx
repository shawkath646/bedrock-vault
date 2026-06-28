import TitleBar from "@renderer/components/navigation/Titlebar";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OptionsForm from "./OptionsForm";

export default function EncryptionOptionsPage() {
    const navigate = useNavigate();

    return (
        <div className="flex h-full flex-col">
            <TitleBar
                component={
                    <div className="flex items-center space-x-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md w-9 h-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                            onClick={() => navigate(-1)}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>

                        <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                                <Settings className="w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                Encryption Options
                            </h1>
                        </div>
                    </div>
                }
            />
            <div className="flex-1 min-h-0">
                <OptionsForm />
            </div>
        </div>
    );
}