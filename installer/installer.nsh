; Bedrock Vault - NSIS Custom Installer Script
; =============================================
; Uncomment and implement sections as needed.
; Reference this file in electron-builder.yml via:
;   nsis.include: installer/installer.nsh

; !macro customInstall
;   ; Add registry entries
;   ; WriteRegStr HKLM "Software\BedrockVault" "InstallPath" "$INSTDIR"
;   ;
;   ; Add context menu entries
;   ; WriteRegStr HKCR "*\shell\BedrockVault" "" "Encrypt with Bedrock Vault"
;   ; WriteRegStr HKCR "*\shell\BedrockVault\command" "" '"$INSTDIR\Bedrock Vault.exe" "%1"'
; !macroend

; !macro customUnInstall
;   ; Remove registry entries
;   ; DeleteRegKey HKLM "Software\BedrockVault"
;   ; DeleteRegKey HKCR "*\shell\BedrockVault"
; !macroend
