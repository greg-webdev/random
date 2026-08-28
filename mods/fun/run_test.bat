@echo off
title Minecraft 1.21.11 - Fun Stuff Testing
cd /d "%~dp0"
echo =========================================================
echo Launching Minecraft 1.21.11 with Fabric, Sodium & Mod Menu
echo =========================================================
call gradlew.bat runClient
pause
