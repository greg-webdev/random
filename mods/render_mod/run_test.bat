@echo off
title Minecraft 1.21.11 - Render Mod Testing
cd /d "%~dp0"
echo =========================================================
echo Launching Minecraft 1.21.11 with 60 FPS Render Recorder Mod
echo =========================================================
call gradlew.bat runClient
pause
