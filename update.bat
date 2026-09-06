@echo off
title Pngtree AI Metadata - 1-Click Auto Updater
color 0A
echo ============================================================
echo         Pngtree AI Metadata Extension - Auto Updater
echo ============================================================
echo.

if exist ".git" (
    echo [1/2] Updating repository via Git...
    git pull origin main
) else (
    echo [1/2] Downloading latest update from GitHub...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Write-Host 'Downloading update.zip...'; Invoke-WebRequest -Uri 'https://github.com/smrkarim555/pngtree-ai-metadata/archive/refs/heads/main.zip' -OutFile 'update.zip'; Write-Host 'Extracting files...'; Expand-Archive -Path 'update.zip' -DestinationPath 'update_temp' -Force; Get-ChildItem 'update_temp' | Select-Object -First 1 | ForEach-Object { Copy-Item -Path ($_.FullName + '\*') -Destination '.' -Recurse -Force }; Remove-Item 'update_temp', 'update.zip' -Recurse -Force; Write-Host 'Successfully updated all files from GitHub!' -ForegroundColor Green } catch { Write-Host 'Download error: ' $_.Exception.Message -ForegroundColor Red }"
)

echo.
echo ============================================================
echo [2/2] Update Complete!
echo.
echo Please open chrome://extensions in Chrome and click the 
echo (Reload) icon on "Pngtree AI Metadata Filler".
echo ============================================================
echo.
pause
