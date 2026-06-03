import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { Switch } from "@renderer/components/ui/switch";
import { Button } from "@renderer/components/ui/button";
import { CircleQuestionMark, FolderOpen, Shield, AlertTriangle } from "lucide-react";
import type { EncryptionOptions } from "@shared/types/fileEncryption";
import { useNavigate } from "react-router-dom";
import { defaultOptions, encryptionLevels } from "@shared/constant/encryptionOptions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, FieldLabel, FieldError } from "@renderer/components/ui/field";

const SECURITY_SWITCHES = [
    { id: "encryptFileNameAndDirectory", label: "Encrypt File Name & Directory", disabled: false },
    { id: "addTrap", label: "Add Trap", disabled: true },
    { id: "addToCloudSync", label: "Add to Cloud Sync", disabled: true },
    { id: "cleanupAfterEncryption", label: "Cleanup After Encryption", disabled: false }
] as const;

export default function OptionsForm() {
    const navigate = useNavigate();
    const [isPasswordSet, setIsPasswordSet] = useState(false);
    const [isTpmAvailable, setIsTpmAvailable] = useState(false);
    const [isSoftwareKspAvailable, setIsSoftwareKspAvailable] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        control,
        setError,
        reset,
        formState: { errors },
    } = useForm<EncryptionOptions>({
        defaultValues: defaultOptions,
    });

    const encryptionLevel = useWatch({ control, name: "encryptionLevel" });

    const pathPickers: Record<string, () => Promise<string | null>> = {
        fileOutputDirectory: window.encryptionOptions.selectOutputPath,
        recoveryPhrasePath: window.encryptionOptions.selectRecoveryPhraseSavePath,
        recoveryPhraseFilePath: window.encryptionOptions.selectFileKeySavePath,
    };

    useEffect(() => {
        let isMounted = true;

        const initLoad = async () => {
            try {
                const [options, tpm, ksp, hasPassword] = await Promise.all([
                    window.encryptionOptions.getOptions(),
                    window.encryptionOptions.isTpmAvailable(),
                    window.encryptionOptions.isSoftwareKspAvailable(),
                    window.encryptionOptions.hasEncryptionPassword()
                ]);

                if (!isMounted) return;

                setIsTpmAvailable(tpm);
                setIsSoftwareKspAvailable(ksp);
                setIsPasswordSet(hasPassword);

                if (options) {
                    const needsCoercion = !tpm && !ksp && (options.encryptionLevel === 2 || options.encryptionLevel === 3);
                    const finalOptions: EncryptionOptions = needsCoercion
                        ? { ...options, encryptionLevel: 1 as const }
                        : options;

                    if (needsCoercion) {
                        await window.encryptionOptions.saveOptions(finalOptions);
                    }
                    reset(finalOptions);
                }
            } catch (error) {
                console.error("Failed to load encryption options:", error);
            }
        };

        void initLoad();
        return () => { isMounted = false; };
    }, [reset]);

    const handlePickPath = async (targetField: keyof EncryptionOptions) => {
        const picker = pathPickers[targetField];
        if (!picker) return;
        
        const selectedPath = await picker();
        if (selectedPath) {
            setValue(targetField, selectedPath, { shouldValidate: true });
        }
    };

    const handleSetPassword = async () => {
        const success = await window.encryptionOptions.promptAndSetPassword();
        if (success) setIsPasswordSet(true);
    };

    const onSubmit = async (data: EncryptionOptions) => {
        const response = await window.encryptionOptions.saveOptions(data);
        if (response.success) {
            navigate("/confirm-encryption");
        } else {
            Object.entries(response.errors).forEach(([field, messages]) => {
                setError(field as keyof EncryptionOptions, {
                    type: "server",
                    message: messages.join(", "),
                });
            });
        }
    };

    const directoryFields = [
        {
            id: "output-dir",
            name: "fileOutputDirectory" as const,
            label: "File Output Directory",
            placeholder: "Select directory for encrypted files...",
            show: true
        },
        {
            id: "key-dir",
            name: "recoveryPhrasePath" as const,
            label: "Recovery Phrase Path",
            placeholder: "Select directory for recovery phrase...",
            show: true
        },
        {
            id: "file-key-dir",
            name: "recoveryPhraseFilePath" as const,
            label: "Supportive Key File Path",
            placeholder: "Select directory for supportive key file...",
            show: encryptionLevel === 3
        }
    ];

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-4">
                
                {/* Encryption Level Selection */}
                <Field aria-invalid={!!errors.encryptionLevel} className="space-y-4 mb-8">
                    <FieldLabel className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Encryption Level
                    </FieldLabel>

                    <Controller
                        control={control}
                        name="encryptionLevel"
                        render={({ field }) => (
                            <RadioGroup
                                value={String(field.value)}
                                onValueChange={(val) => field.onChange(Number(val) as 1 | 2 | 3)}
                                className="flex flex-col gap-4"
                            >
                                {encryptionLevels.map((level) => {
                                    const isProviderUnavailable = (level.value === 2 || level.value === 3) && !isTpmAvailable && !isSoftwareKspAvailable;
                                    return (
                                        <div key={level.id} className="flex items-start gap-3">
                                            <div className="mt-1">
                                                <RadioGroupItem
                                                    value={String(level.value || level.id)}
                                                    id={level.id}
                                                    disabled={isProviderUnavailable}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Label
                                                        htmlFor={level.id}
                                                        className={`cursor-pointer font-medium text-gray-900 dark:text-gray-100 ${isProviderUnavailable ? 'opacity-40 cursor-not-allowed text-muted-foreground' : ''}`}
                                                    >
                                                        {level.label}
                                                    </Label>

                                                    {level.tooltipMsg && (
                                                        <Tooltip>
                                                            <TooltipTrigger type="button" className="cursor-help">
                                                                <CircleQuestionMark className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p className="max-w-xs">{level.tooltipMsg}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}

                                                    {!isTpmAvailable && level.value !== 1 && (
                                                        isSoftwareKspAvailable ? (
                                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                TPM unavailable. Falling back to Microsoft Software KSP.
                                                            </p>
                                                        ) : (
                                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                TPM and Microsoft Software KSP provider unavailable. Cannot use this level.
                                                            </p>
                                                        )
                                                    )}
                                                </div>

                                                <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed ${isProviderUnavailable ? 'opacity-40' : ''}`}>
                                                    {level.desc}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </RadioGroup>
                        )}
                    />
                    <FieldError errors={[errors.encryptionLevel]} />
                </Field>

                <div className="grid grid-cols-2 gap-6">
                    {/* Left Panel: Directory Pickers */}
                    <section className="space-y-4">
                        {directoryFields.filter(f => f.show).map((field) => (
                            <Field key={field.id} aria-invalid={!!errors[field.name]}>
                                <FieldLabel htmlFor={field.id}>
                                    {field.label}
                                </FieldLabel>
                                <div className="flex gap-2">
                                    <Input
                                        id={field.id}
                                        type="text"
                                        {...register(field.name)}
                                        placeholder={field.placeholder}
                                        className="h-9"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0"
                                        onClick={() => handlePickPath(field.name)}
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                    </Button>
                                </div>
                                <FieldError errors={[errors[field.name]]} />
                            </Field>
                        ))}
                    </section>

                    {/* Right Panel: Security Toggles */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-medium text-foreground">Security Options</h3>

                        <div className="space-y-2">
                            {/* Password Setup Element */}
                            <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-2 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Shield className={`h-3.5 w-3.5 ${isPasswordSet ? 'text-emerald-500' : 'text-amber-500'}`} />
                                        Encryption Password
                                    </Label>
                                    <Button
                                        type="button"
                                        variant={isPasswordSet ? "outline" : "default"}
                                        size="sm"
                                        onClick={handleSetPassword}
                                        className={`text-xs h-8 ${!isPasswordSet ? 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-sm transition-all duration-300' : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/10'}`}
                                    >
                                        {isPasswordSet ? "Change Password" : "Set Password"}
                                    </Button>
                                </div>
                            </div>

                            {SECURITY_SWITCHES.map(({ id, label, disabled }) => (
                                <Field key={id} orientation="horizontal" className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
                                    <FieldLabel htmlFor={id} className="text-xs font-normal text-foreground cursor-pointer group-data-[disabled=true]/field:text-muted-foreground!">
                                        {label}
                                    </FieldLabel>
                                    <Controller
                                        control={control}
                                        name={id as keyof EncryptionOptions}
                                        render={({ field }) => (
                                            <Switch
                                                id={id}
                                                disabled={disabled}
                                                checked={Boolean(field.value)}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                </Field>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* Action Footer */}
            <div className="shrink-0 border-t border-border/40 bg-background px-6 py-4 flex justify-end">
                <Button
                    type="submit"
                    size="lg"
                    className="px-8 shadow-sm font-medium transition-all"
                    disabled={!isPasswordSet}
                >
                    <Shield className="mr-2 h-4 w-4" />
                    Encrypt
                </Button>
            </div>
        </form>
    );
}