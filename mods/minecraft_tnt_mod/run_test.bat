@echo off
title Minecraft 1.21.11 - TNT Mod Testing
cd /d "%~dp0"
echo =========================================================
echo Launching Minecraft 1.21.11 with TNT Mod
echo =========================================================
call gradlew.bat runClient
pause
